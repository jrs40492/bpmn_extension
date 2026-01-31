import * as vscode from 'vscode';
import { getNonce } from './util/nonce';
import { Disposable, disposeAll } from './util/dispose';
import type { ExtensionToWebviewMessage, WebviewToExtensionMessage, ValidationIssue, DmnFileInfo } from '../shared/message-types';
import {
  extractMessageEventsFromContent,
  generateJavaClasses,
  updateBpmnWithItemDefinition,
  MessageEventInfo
} from './commands/generate-message-classes';
import { getProjectInfo } from './utils/project-utils';

/**
 * Provider for BPMN custom editors.
 * Uses CustomTextEditorProvider to leverage VS Code's TextDocument model
 * for automatic save handling and undo/redo support.
 */
export class BpmnEditorProvider implements vscode.CustomTextEditorProvider {
  private static readonly viewType = 'bamoe.bpmnEditor';

  /**
   * Diagnostics collection for BPMN validation issues
   */
  private readonly diagnosticCollection: vscode.DiagnosticCollection;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('bpmn');
  }

  /**
   * Register the provider with VS Code
   */
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new BpmnEditorProvider(context);

    const providerRegistration = vscode.window.registerCustomEditorProvider(
      BpmnEditorProvider.viewType,
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true
        },
        supportsMultipleEditorsPerDocument: false
      }
    );

    return vscode.Disposable.from(providerRegistration, provider.diagnosticCollection);
  }

  /**
   * Called when a custom editor is opened
   */
  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // Set up the webview
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview'),
        vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'font')
      ]
    };

    // Generate the webview HTML
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    // Track the last XML content we know about to prevent update loops
    let lastKnownXml = document.getText();

    // Track if we should skip document change events
    // Use a counter to handle multiple rapid changes
    let skipDocumentChangeCount = 0;

    // Handle messages from the webview
    const messageHandler = webviewPanel.webview.onDidReceiveMessage(
      async (message: WebviewToExtensionMessage) => {
        switch (message.type) {
          case 'ready':
            // Webview is ready, send initial content
            lastKnownXml = document.getText();
            this.postMessage(webviewPanel.webview, {
              type: 'init',
              xml: lastKnownXml,
              isUntitled: document.isUntitled
            });
            break;

          case 'change':
            // Webview content changed, update document
            // Skip if the content is the same (prevents loops)
            if (message.xml === lastKnownXml) {
              break;
            }
            lastKnownXml = message.xml;
            skipDocumentChangeCount++;
            await this.updateTextDocument(document, message.xml);
            break;

          case 'validation':
            // Update diagnostics
            this.updateDiagnostics(document.uri, message.issues);
            break;

          case 'requestDmnFiles':
            // Find and return available DMN files
            console.log('[BAMOE] Received requestDmnFiles message');
            const dmnFiles = await this.findDmnFiles();
            console.log('[BAMOE] Found DMN files:', dmnFiles);
            this.postMessage(webviewPanel.webview, {
              type: 'dmnFiles',
              files: dmnFiles
            });
            break;

          case 'generateMessageClasses':
            // Generate message classes for the current BPMN file
            console.log('[BAMOE] Received generateMessageClasses message');
            try {
              const result = await this.generateMessageClassesForDocument(document);
              this.postMessage(webviewPanel.webview, {
                type: 'generateMessageClassesResult',
                success: true,
                generatedFiles: result.generated
              });
            } catch (error) {
              console.error('[BAMOE] Message class generation failed:', error);
              this.postMessage(webviewPanel.webview, {
                type: 'generateMessageClassesResult',
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
              });
            }
            break;
        }
      }
    );

    // Handle document changes (including external changes and undo/redo)
    const documentChangeHandler = vscode.workspace.onDidChangeTextDocument(event => {
      if (event.document.uri.toString() !== document.uri.toString()) {
        return;
      }

      // Skip if this change originated from our webview
      if (skipDocumentChangeCount > 0) {
        skipDocumentChangeCount--;
        return;
      }

      const currentXml = document.getText();

      // Skip if the content is the same as what we already know
      if (currentXml === lastKnownXml) {
        return;
      }

      // Update our tracking and send to webview (e.g., for undo/redo or external changes)
      lastKnownXml = currentXml;
      this.postMessage(webviewPanel.webview, {
        type: 'update',
        xml: currentXml
      });
    });

    // Handle document save for auto-generation of message classes
    const documentSaveHandler = vscode.workspace.onDidSaveTextDocument(async (savedDocument) => {
      if (savedDocument.uri.toString() !== document.uri.toString()) {
        return;
      }

      // Check if auto-generation is enabled
      const config = vscode.workspace.getConfiguration('bamoe');
      const autoGenerate = config.get<boolean>('autoGenerateMessageClasses', true);

      if (!autoGenerate) {
        return;
      }

      // Extract message events from the saved BPMN
      const bpmnXml = savedDocument.getText();
      const events = extractMessageEventsFromContent(bpmnXml, savedDocument.uri.fsPath);

      // Only generate if there are message events with payload definitions
      if (events.length === 0) {
        return;
      }

      // Auto-generate Java classes in the background
      try {
        await this.autoGenerateMessageClasses(events);
      } catch (error) {
        // Log error but don't interrupt the save flow
        console.error('[BAMOE] Auto-generation failed:', error);
      }
    });

    // Clean up when the editor is closed
    webviewPanel.onDidDispose(() => {
      messageHandler.dispose();
      documentChangeHandler.dispose();
      documentSaveHandler.dispose();
      this.diagnosticCollection.delete(document.uri);
    });
  }

  /**
   * Generate Java message classes for a specific document (triggered from webview)
   * Shows VS Code notification with results
   */
  private async generateMessageClassesForDocument(document: vscode.TextDocument): Promise<{ generated: string[] }> {
    // Extract message events from the BPMN
    const bpmnXml = document.getText();
    const events = extractMessageEventsFromContent(bpmnXml, document.uri.fsPath);

    if (events.length === 0) {
      vscode.window.showInformationMessage(
        'No message events with payload definitions found. Define payload fields on Message Events first.'
      );
      return { generated: [] };
    }

    // Get project info
    const projectInfo = await getProjectInfo();

    if (!projectInfo.projectRoot) {
      throw new Error('No workspace folder found. Please open a folder first.');
    }

    // Generate classes
    const { generated } = await generateJavaClasses(
      events,
      projectInfo.basePackage,
      projectInfo.projectRoot
    );

    if (generated.length > 0) {
      const relativePaths = generated.map(p =>
        vscode.workspace.asRelativePath(p, false)
      );
      vscode.window.showInformationMessage(
        `Generated ${generated.length} Java class(es): ${relativePaths.join(', ')}`,
        'Open Folder'
      ).then(action => {
        if (action === 'Open Folder' && generated.length > 0) {
          const folderPath = require('path').dirname(generated[0]);
          vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(folderPath));
        }
      });
    } else {
      vscode.window.showInformationMessage('No message classes needed to be generated.');
    }

    return { generated };
  }

  /**
   * Auto-generate Java message classes when BPMN is saved
   * Shows subtle status bar notification instead of dialog
   */
  private async autoGenerateMessageClasses(events: MessageEventInfo[]): Promise<void> {
    // Get project info
    const projectInfo = await getProjectInfo();

    if (!projectInfo.projectRoot) {
      return; // No workspace, skip silently
    }

    // Show status bar message
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
    statusBarItem.text = '$(sync~spin) Generating message classes...';
    statusBarItem.show();

    try {
      // Generate classes
      const { generated } = await generateJavaClasses(
        events,
        projectInfo.basePackage,
        projectInfo.projectRoot
      );

      // Update BPMN files with itemDefinition references (skip to avoid save loop)
      // Note: We don't update BPMN here since it would cause another save trigger
      // The manual command can be used if itemDefinition updates are needed

      // Update status bar to show success briefly
      if (generated.length > 0) {
        statusBarItem.text = `$(check) Generated ${generated.length} message class(es)`;
        setTimeout(() => statusBarItem.dispose(), 3000);
      } else {
        statusBarItem.dispose();
      }
    } catch (error) {
      statusBarItem.text = '$(error) Message class generation failed';
      setTimeout(() => statusBarItem.dispose(), 3000);
      throw error;
    }
  }

  /**
   * Post a message to the webview
   */
  private postMessage(webview: vscode.Webview, message: ExtensionToWebviewMessage): void {
    webview.postMessage(message);
  }

  /**
   * Update the text document with new XML content
   */
  private async updateTextDocument(document: vscode.TextDocument, xml: string): Promise<void> {
    const edit = new vscode.WorkspaceEdit();

    // Replace the entire document content
    edit.replace(
      document.uri,
      new vscode.Range(0, 0, document.lineCount, 0),
      xml
    );

    await vscode.workspace.applyEdit(edit);
  }

  /**
   * Find all DMN files in the workspace and extract their decisions and namespace
   */
  private async findDmnFiles(): Promise<DmnFileInfo[]> {
    const dmnFiles: DmnFileInfo[] = [];

    // Find all .dmn files in the workspace
    const files = await vscode.workspace.findFiles('**/*.dmn', '**/node_modules/**');

    for (const file of files) {
      try {
        const document = await vscode.workspace.openTextDocument(file);
        const content = document.getText();

        // Parse decisions from the DMN XML
        const decisions = this.parseDecisionsFromDmn(content);

        // Parse namespace from the DMN XML (required for Kogito/jBPM)
        const namespace = this.parseNamespaceFromDmn(content);

        // Parse model name from the DMN XML (required for Kogito/jBPM model input)
        const modelName = this.parseModelNameFromDmn(content);

        // Parse input data from the DMN XML (required for Kogito/jBPM input mapping)
        const inputData = this.parseInputDataFromDmn(content);

        // Parse output data from the DMN XML (required for Kogito/jBPM output mapping)
        const outputData = this.parseOutputDataFromDmn(content, decisions);

        // Get relative path for display
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(file);
        const relativePath = workspaceFolder
          ? vscode.workspace.asRelativePath(file, false)
          : file.fsPath;

        dmnFiles.push({
          path: file.fsPath,
          name: relativePath,
          modelName,
          namespace,
          decisions,
          inputData,
          outputData
        });
      } catch (error) {
        console.error(`Error reading DMN file ${file.fsPath}:`, error);
      }
    }

    return dmnFiles;
  }

  /**
   * Parse namespace from DMN XML content
   * The namespace is in the definitions element's namespace attribute
   */
  private parseNamespaceFromDmn(xml: string): string | undefined {
    // Try to find namespace attribute in definitions element
    // Matches: <definitions namespace="..." or <dmn:definitions namespace="..."
    const namespaceRegex = /<(?:dmn:)?definitions[^>]*\snamespace\s*=\s*["']([^"']+)["']/i;
    const match = namespaceRegex.exec(xml);
    return match?.[1];
  }

  /**
   * Parse model name from DMN XML content
   * The model name is in the definitions element's name attribute
   * Kogito/jBPM uses this name (not the filename) to identify the DMN model
   */
  private parseModelNameFromDmn(xml: string): string | undefined {
    // Try to find name attribute in definitions element
    // Matches: <definitions name="..." or <dmn:definitions name="..."
    const nameRegex = /<(?:dmn:)?definitions[^>]*\sname\s*=\s*["']([^"']+)["']/i;
    const match = nameRegex.exec(xml);
    return match?.[1];
  }

  /**
   * Parse input data elements from DMN XML content
   * These are the inputs that DMN decisions expect to receive
   */
  private parseInputDataFromDmn(xml: string): Array<{ id: string; name: string; typeRef?: string }> {
    const inputData: Array<{ id: string; name: string; typeRef?: string }> = [];

    // Match inputData elements: <inputData id="..." name="...">
    // Also capture the variable element inside for typeRef
    const inputDataRegex = /<(?:dmn:)?inputData[^>]*\sid\s*=\s*["']([^"']+)["'][^>]*\sname\s*=\s*["']([^"']+)["'][^>]*>[\s\S]*?<(?:dmn:)?variable[^>]*(?:\stypeRef\s*=\s*["']([^"']+)["'])?[^>]*\/>[\s\S]*?<\/(?:dmn:)?inputData>/gi;

    // Also try name before id
    const inputDataRegexAlt = /<(?:dmn:)?inputData[^>]*\sname\s*=\s*["']([^"']+)["'][^>]*\sid\s*=\s*["']([^"']+)["'][^>]*>[\s\S]*?<(?:dmn:)?variable[^>]*(?:\stypeRef\s*=\s*["']([^"']+)["'])?[^>]*\/>[\s\S]*?<\/(?:dmn:)?inputData>/gi;

    // Simpler regex that just gets id and name from the inputData element itself
    const simpleRegex = /<(?:dmn:)?inputData[^>]*\sid\s*=\s*["']([^"']+)["'][^>]*\sname\s*=\s*["']([^"']+)["'][^>]*>/gi;
    const simpleRegexAlt = /<(?:dmn:)?inputData[^>]*\sname\s*=\s*["']([^"']+)["'][^>]*\sid\s*=\s*["']([^"']+)["'][^>]*>/gi;

    let match;

    // Try simple regex first (id before name)
    while ((match = simpleRegex.exec(xml)) !== null) {
      const id = match[1];
      const name = match[2];
      inputData.push({ id, name });
    }

    // If no matches, try name before id
    if (inputData.length === 0) {
      while ((match = simpleRegexAlt.exec(xml)) !== null) {
        const name = match[1];
        const id = match[2];
        inputData.push({ id, name });
      }
    }

    // Deduplicate by ID
    const seen = new Set<string>();
    return inputData.filter(d => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });
  }

  /**
   * Parse output data (decision variables) from DMN XML content
   * Each decision has a variable element that defines its output
   */
  private parseOutputDataFromDmn(xml: string, decisions: Array<{ id: string; name: string }>): Array<{ decisionId: string; decisionName: string; variableName: string; typeRef?: string }> {
    const outputData: Array<{ decisionId: string; decisionName: string; variableName: string; typeRef?: string }> = [];

    for (const decision of decisions) {
      // Find the decision element and extract its variable
      // Pattern: <decision id="Decision_1" ...> ... <variable ... name="..." typeRef="..." /> ... </decision>
      const decisionPattern = new RegExp(
        `<(?:dmn:)?decision[^>]*\\sid\\s*=\\s*["']${decision.id}["'][^>]*>[\\s\\S]*?<(?:dmn:)?variable[^>]*\\sname\\s*=\\s*["']([^"']+)["'][^>]*(?:\\stypeRef\\s*=\\s*["']([^"']+)["'])?[^>]*\\/>[\\s\\S]*?<\\/(?:dmn:)?decision>`,
        'i'
      );

      // Also try with typeRef before name
      const decisionPatternAlt = new RegExp(
        `<(?:dmn:)?decision[^>]*\\sid\\s*=\\s*["']${decision.id}["'][^>]*>[\\s\\S]*?<(?:dmn:)?variable[^>]*(?:\\stypeRef\\s*=\\s*["']([^"']+)["'])?[^>]*\\sname\\s*=\\s*["']([^"']+)["'][^>]*\\/>[\\s\\S]*?<\\/(?:dmn:)?decision>`,
        'i'
      );

      let match = decisionPattern.exec(xml);
      if (match) {
        outputData.push({
          decisionId: decision.id,
          decisionName: decision.name,
          variableName: match[1],
          typeRef: match[2]
        });
      } else {
        match = decisionPatternAlt.exec(xml);
        if (match) {
          outputData.push({
            decisionId: decision.id,
            decisionName: decision.name,
            variableName: match[2],
            typeRef: match[1]
          });
        } else {
          // If no variable found, use the decision name as the output variable name
          // This is the default behavior in DMN
          outputData.push({
            decisionId: decision.id,
            decisionName: decision.name,
            variableName: decision.name
          });
        }
      }
    }

    return outputData;
  }

  /**
   * Parse decision IDs and names from DMN XML content
   */
  private parseDecisionsFromDmn(xml: string): Array<{ id: string; name: string }> {
    const decisions: Array<{ id: string; name: string }> = [];

    // Simple regex-based parsing for decision elements
    // Matches: <decision id="..." name="..."> or <dmn:decision id="..." name="...">
    const decisionRegex = /<(?:dmn:)?decision[^>]*\sid\s*=\s*["']([^"']+)["'][^>]*(?:\sname\s*=\s*["']([^"']+)["'])?[^>]*>/gi;

    // Also try the reverse order (name before id)
    const decisionRegexAlt = /<(?:dmn:)?decision[^>]*\sname\s*=\s*["']([^"']+)["'][^>]*\sid\s*=\s*["']([^"']+)["'][^>]*>/gi;

    let match;

    // First pass: id before name
    while ((match = decisionRegex.exec(xml)) !== null) {
      const id = match[1];
      const name = match[2] || id; // Use ID as name if no name attribute
      decisions.push({ id, name });
    }

    // Second pass: name before id (if we didn't find any)
    if (decisions.length === 0) {
      while ((match = decisionRegexAlt.exec(xml)) !== null) {
        const name = match[1];
        const id = match[2];
        decisions.push({ id, name });
      }
    }

    // Deduplicate by ID
    const seen = new Set<string>();
    return decisions.filter(d => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });
  }

  /**
   * Update VS Code diagnostics from validation issues
   */
  private updateDiagnostics(uri: vscode.Uri, issues: ValidationIssue[]): void {
    const diagnostics = issues.map(issue => {
      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 0), // BPMN validation doesn't provide line numbers
        `[${issue.rule}] ${issue.message}`,
        issue.category === 'error'
          ? vscode.DiagnosticSeverity.Error
          : vscode.DiagnosticSeverity.Warning
      );
      diagnostic.source = 'bpmnlint';
      diagnostic.code = issue.rule;
      return diagnostic;
    });

    this.diagnosticCollection.set(uri, diagnostics);
  }

  /**
   * Generate the HTML content for the webview
   */
  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'webview.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'webview.css')
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    img-src ${webview.cspSource} https: data:;
    script-src 'nonce-${nonce}';
    style-src ${webview.cspSource} 'unsafe-inline';
    font-src ${webview.cspSource};
  ">
  <link href="${styleUri}" rel="stylesheet">
  <title>BPMN Editor</title>
</head>
<body>
  <div class="editor-container">
    <div class="toolbar">
      <div class="toolbar-group">
        <button id="btn-templates" class="toolbar-btn" title="BPMN Templates">
          <span class="toolbar-icon">📋</span>
          <span class="toolbar-label">Templates</span>
        </button>
        <button id="btn-search" class="toolbar-btn" title="Search Elements (Ctrl+F)">
          <span class="toolbar-icon">🔍</span>
          <span class="toolbar-label">Search</span>
        </button>
      </div>
      <div class="toolbar-group">
        <button id="btn-simulate" class="toolbar-btn" title="Process Simulation">
          <span class="toolbar-icon">▶️</span>
          <span class="toolbar-label">Simulate</span>
        </button>
      </div>
      <div class="toolbar-group">
        <button id="btn-comments" class="toolbar-btn" title="Comments">
          <span class="toolbar-icon">💬</span>
          <span class="toolbar-label">Comments</span>
        </button>
        <button id="btn-diff" class="toolbar-btn" title="Version Diff">
          <span class="toolbar-icon">📊</span>
          <span class="toolbar-label">Diff</span>
        </button>
      </div>
      <div class="toolbar-group">
        <button id="btn-deploy" class="toolbar-btn" title="Deploy to Engine">
          <span class="toolbar-icon">🚀</span>
          <span class="toolbar-label">Deploy</span>
        </button>
        <button id="btn-compliance" class="toolbar-btn" title="BPMN Compliance">
          <span class="toolbar-icon">✓</span>
          <span class="toolbar-label">Compliance</span>
        </button>
      </div>
      <div class="toolbar-group">
        <button id="btn-extensions" class="toolbar-btn" title="BPMN Extensions">
          <span class="toolbar-icon">🧩</span>
          <span class="toolbar-label">Extensions</span>
        </button>
        <button id="btn-project" class="toolbar-btn" title="Project Files">
          <span class="toolbar-icon">📂</span>
          <span class="toolbar-label">Project</span>
        </button>
      </div>
    </div>
    <div class="editor-main">
      <div class="canvas-container">
        <div id="canvas"></div>
        <div class="zoom-controls">
          <button id="zoom-in" title="Zoom In (+)">+</button>
          <button id="zoom-out" title="Zoom Out (-)">−</button>
          <button id="zoom-fit" title="Fit to Viewport">Fit</button>
          <button id="zoom-reset" title="Reset Zoom (100%)">1:1</button>
        </div>
      </div>
      <div id="properties-panel" class="properties-panel"></div>
    </div>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
