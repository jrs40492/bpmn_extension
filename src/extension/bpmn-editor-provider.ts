import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { getNonce } from './util/nonce';
import { Disposable, disposeAll } from './util/dispose';

const execAsync = promisify(exec);
import type { ExtensionToWebviewMessage, WebviewToExtensionMessage, ValidationIssue, DmnFileInfo, DmnInputDefinition } from '../shared/message-types';
import {
  extractMessageEventsFromContent,
  generateJavaClasses,
  updateBpmnWithItemDefinition,
  MessageEventInfo
} from './commands/generate-message-classes';
import { getProjectInfo } from './utils/project-utils';
import { generateFormHtml, generateFormConfig } from './utils/form-generator';

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

          case 'createDmnFile':
            // Create a new DMN file with the specified inputs
            console.log('[BAMOE] Received createDmnFile message:', message);
            try {
              const createResult = await this.createDmnFile(
                document,
                message.fileName,
                message.modelName,
                message.inputs
              );
              this.postMessage(webviewPanel.webview, {
                type: 'createDmnFileResult',
                ...createResult
              });
              // Also refresh DMN files list
              const updatedFiles = await this.findDmnFiles();
              this.postMessage(webviewPanel.webview, { type: 'dmnFiles', files: updatedFiles });
            } catch (error) {
              console.error('[BAMOE] DMN file creation failed:', error);
              this.postMessage(webviewPanel.webview, {
                type: 'createDmnFileResult',
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
              });
            }
            break;

          case 'requestGitDiff':
            // Get the committed version of the file from git
            const gitResult = await this.getGitCommittedVersion(document);
            this.postMessage(webviewPanel.webview, {
              type: 'gitDiffResponse',
              ...gitResult
            });
            break;

          case 'generateUserTaskForm':
            // Generate HTML form and config files for a user task
            console.log('[BAMOE] Received generateUserTaskForm message:', message.taskName);
            try {
              const formResult = await this.generateUserTaskForm(
                document,
                message.taskId,
                message.taskName,
                message.inputs,
                message.outputs
              );
              this.postMessage(webviewPanel.webview, {
                type: 'generateUserTaskFormResult',
                ...formResult
              });
            } catch (error) {
              console.error('[BAMOE] Form generation failed:', error);
              this.postMessage(webviewPanel.webview, {
                type: 'generateUserTaskFormResult',
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
   * Generate HTML form and config files for a user task
   */
  private async generateUserTaskForm(
    document: vscode.TextDocument,
    taskId: string,
    taskName: string,
    inputs: Array<{ name: string; dtype: string; variable?: string; defaultValue?: string }>,
    outputs: Array<{ name: string; dtype: string; variable?: string; defaultValue?: string }>
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    // Extract process ID from the BPMN XML
    const bpmnXml = document.getText();
    const processIdMatch = /<(?:bpmn2?:)?process[^>]*\sid\s*=\s*["']([^"']+)["']/i.exec(bpmnXml);
    const processId = processIdMatch?.[1] || 'process';

    // Sanitize task name for filename (remove spaces, special chars)
    const sanitizedTaskName = taskName.replace(/[^a-zA-Z0-9_]/g, '');
    const baseName = `${processId}_${sanitizedTaskName}`;

    // Determine output directory
    const projectInfo = await getProjectInfo();
    let outputDir: vscode.Uri;

    if (projectInfo.projectRoot) {
      // Maven project: use src/main/resources/forms/
      outputDir = vscode.Uri.file(
        path.join(projectInfo.projectRoot, 'src', 'main', 'resources', 'forms')
      );
    } else {
      // Fallback: same directory as the BPMN file
      outputDir = vscode.Uri.joinPath(document.uri, '..');
    }

    // Ensure output directory exists
    await vscode.workspace.fs.createDirectory(outputDir);

    // Generate files
    const htmlContent = generateFormHtml(taskName, inputs, outputs);
    const configContent = generateFormConfig(inputs, outputs);

    const htmlUri = vscode.Uri.joinPath(outputDir, `${baseName}.html`);
    const configUri = vscode.Uri.joinPath(outputDir, `${baseName}.config`);

    await vscode.workspace.fs.writeFile(htmlUri, Buffer.from(htmlContent, 'utf-8'));
    await vscode.workspace.fs.writeFile(configUri, Buffer.from(configContent, 'utf-8'));

    const relativePath = vscode.workspace.asRelativePath(htmlUri, false);
    vscode.window.showInformationMessage(`Generated form: ${relativePath}`);

    return { success: true, filePath: relativePath };
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
   * Create a new DMN file with the specified inputs
   * Saves the file in the same directory as the current BPMN file
   */
  private async createDmnFile(
    bpmnDocument: vscode.TextDocument,
    fileName: string,
    modelName: string,
    inputs: DmnInputDefinition[]
  ): Promise<{ success: boolean; file?: DmnFileInfo; error?: string }> {
    try {
      // Validate inputs
      if (!fileName || !fileName.trim()) {
        return { success: false, error: 'File name is required' };
      }
      if (!modelName || !modelName.trim()) {
        return { success: false, error: 'Model name is required' };
      }

      // Clean up file name (remove extension if provided)
      const cleanFileName = fileName.trim().replace(/\.dmn$/i, '');

      // Determine the directory to save the file
      // Use the same directory as the current BPMN file
      const bpmnDir = vscode.Uri.joinPath(bpmnDocument.uri, '..');
      const dmnUri = vscode.Uri.joinPath(bpmnDir, `${cleanFileName}.dmn`);

      // Check if file already exists
      try {
        await vscode.workspace.fs.stat(dmnUri);
        return { success: false, error: `File "${cleanFileName}.dmn" already exists` };
      } catch {
        // File doesn't exist, we can proceed
      }

      // Generate DMN XML content
      const dmnContent = this.generateDmnContent(cleanFileName, modelName, inputs);

      // Write the file
      await vscode.workspace.fs.writeFile(dmnUri, Buffer.from(dmnContent, 'utf-8'));

      // Parse the newly created file to return its info
      const document = await vscode.workspace.openTextDocument(dmnUri);
      const content = document.getText();
      const decisions = this.parseDecisionsFromDmn(content);
      const namespace = this.parseNamespaceFromDmn(content);
      const parsedModelName = this.parseModelNameFromDmn(content);
      const inputData = this.parseInputDataFromDmn(content);
      const outputData = this.parseOutputDataFromDmn(content, decisions);

      // Get relative path for display
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(dmnUri);
      const relativePath = workspaceFolder
        ? vscode.workspace.asRelativePath(dmnUri, false)
        : dmnUri.fsPath;

      const fileInfo: DmnFileInfo = {
        path: dmnUri.fsPath,
        name: relativePath,
        modelName: parsedModelName,
        namespace,
        decisions,
        inputData,
        outputData
      };

      // Show success message
      vscode.window.showInformationMessage(`Created DMN file: ${relativePath}`);

      return { success: true, file: fileInfo };
    } catch (error) {
      console.error('[BAMOE] Error creating DMN file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error creating DMN file'
      };
    }
  }

  /**
   * Generate DMN XML content with the specified inputs
   */
  private generateDmnContent(
    fileName: string,
    modelName: string,
    inputs: DmnInputDefinition[]
  ): string {
    const uniqueId = `Definitions_${Date.now()}`;
    const namespace = 'http://camunda.org/schema/1.0/dmn';

    // Generate input data elements
    const inputDataElements = inputs.map((input, _index) => {
      const inputId = `InputData_${this.sanitizeId(input.name)}`;
      return `  <inputData id="${inputId}" name="${this.escapeXml(input.name)}">
    <variable id="Variable_${this.sanitizeId(input.name)}" name="${this.escapeXml(input.name)}" typeRef="${input.typeRef}" />
  </inputData>`;
    }).join('\n');

    // Generate information requirements for the decision
    const informationRequirements = inputs.map((input, _index) => {
      const inputId = `InputData_${this.sanitizeId(input.name)}`;
      return `    <informationRequirement id="IR_${this.sanitizeId(input.name)}">
      <requiredInput href="#${inputId}" />
    </informationRequirement>`;
    }).join('\n');

    // Generate decision table inputs
    const decisionTableInputs = inputs.map((input, index) => {
      return `      <input id="Input_${index + 1}" label="${this.escapeXml(input.name)}">
        <inputExpression id="InputExpression_${index + 1}" typeRef="${input.typeRef}">
          <text>${this.escapeXml(input.name)}</text>
        </inputExpression>
      </input>`;
    }).join('\n');

    // Generate empty input entries for the default rule
    const inputEntries = inputs.map((_, index) => {
      return `        <inputEntry id="InputEntry_${index + 1}">
          <text></text>
        </inputEntry>`;
    }).join('\n');

    // Generate DMN shapes for the diagram
    const inputShapes = inputs.map((input, index) => {
      const inputId = `InputData_${this.sanitizeId(input.name)}`;
      // Position inputs in a row above the decision
      const x = 80 + (index * 200);
      const y = 200;
      return `      <dmndi:DMNShape id="DMNShape_${inputId}" dmnElementRef="${inputId}">
        <dc:Bounds x="${x}" y="${y}" width="160" height="50" />
      </dmndi:DMNShape>`;
    }).join('\n');

    // Generate edges from inputs to decision
    const inputEdges = inputs.map((input, index) => {
      const inputId = `InputData_${this.sanitizeId(input.name)}`;
      const irId = `IR_${this.sanitizeId(input.name)}`;
      // Draw edge from input data to decision
      const inputX = 80 + (index * 200) + 80; // center of input
      const decisionX = 160 + 90; // center of decision
      return `      <dmndi:DMNEdge id="DMNEdge_${irId}" dmnElementRef="${irId}">
        <di:waypoint x="${inputX}" y="${200}" />
        <di:waypoint x="${decisionX}" y="${80 + 80}" />
      </dmndi:DMNEdge>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
             xmlns:dmndi="https://www.omg.org/spec/DMN/20191111/DMNDI/"
             xmlns:dc="http://www.omg.org/spec/DMN/20180521/DC/"
             xmlns:di="http://www.omg.org/spec/DMN/20180521/DI/"
             id="${uniqueId}"
             name="${this.escapeXml(modelName)}"
             namespace="${namespace}">

${inputDataElements}

  <decision id="Decision_1" name="${this.escapeXml(modelName)}">
    <variable id="DecisionVariable_1" name="${this.escapeXml(modelName)}" typeRef="string" />
${informationRequirements}
    <decisionTable id="DecisionTable_1" hitPolicy="UNIQUE">
${decisionTableInputs}
      <output id="Output_1" label="Output" typeRef="string" />
      <rule id="Rule_1">
${inputEntries}
        <outputEntry id="OutputEntry_1">
          <text></text>
        </outputEntry>
      </rule>
    </decisionTable>
  </decision>

  <dmndi:DMNDI>
    <dmndi:DMNDiagram id="DMNDiagram_1">
      <dmndi:DMNShape id="DMNShape_Decision_1" dmnElementRef="Decision_1">
        <dc:Bounds x="160" y="80" width="180" height="80" />
      </dmndi:DMNShape>
${inputShapes}
${inputEdges}
    </dmndi:DMNDiagram>
  </dmndi:DMNDI>
</definitions>`;
  }

  /**
   * Sanitize a string to be used as an XML ID
   */
  private sanitizeId(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  /**
   * Escape special XML characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
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
   * Get the committed version of a file from git
   * Returns the XML content from HEAD or an error
   */
  private async getGitCommittedVersion(document: vscode.TextDocument): Promise<{
    success: boolean;
    xml?: string;
    commitHash?: string;
    error?: { code: string; message: string };
  }> {
    const filePath = document.uri.fsPath;
    const cwd = path.dirname(filePath);
    const fileName = path.basename(filePath);

    try {
      // Check if we're in a git repo
      try {
        await execAsync('git rev-parse --is-inside-work-tree', { cwd });
      } catch {
        return {
          success: false,
          error: {
            code: 'NOT_GIT_REPO',
            message: 'This file is not in a Git repository. Git diff requires the file to be part of a Git repository.'
          }
        };
      }

      // Get the relative path from the git root
      let relativePath: string;
      let gitRootPath = cwd;
      try {
        const { stdout: gitRoot } = await execAsync('git rev-parse --show-toplevel', { cwd });
        gitRootPath = gitRoot.trim();
        relativePath = path.relative(gitRootPath, filePath);
      } catch {
        relativePath = fileName;
      }

      // Check if file is tracked by git
      try {
        const { stdout } = await execAsync(`git ls-files "${relativePath}"`, { cwd: gitRootPath });
        if (!stdout.trim()) {
          return {
            success: false,
            error: {
              code: 'FILE_UNTRACKED',
              message: 'This file is not tracked by Git yet. Commit the file first to enable version comparison.'
            }
          };
        }
      } catch {
        return {
          success: false,
          error: {
            code: 'FILE_UNTRACKED',
            message: 'This file is not tracked by Git yet. Commit the file first to enable version comparison.'
          }
        };
      }

      // Check if file has any commits
      try {
        await execAsync(`git log -1 -- "${relativePath}"`, { cwd: gitRootPath });
      } catch {
        return {
          success: false,
          error: {
            code: 'NO_COMMITS',
            message: 'This file has no commit history. Commit the file first to enable version comparison.'
          }
        };
      }

      // Get the committed version from HEAD
      const { stdout: xml } = await execAsync(`git show HEAD:"${relativePath}"`, { cwd: gitRootPath });

      // Get the short commit hash for display
      const { stdout: commitHash } = await execAsync('git rev-parse --short HEAD', { cwd });

      return {
        success: true,
        xml: xml,
        commitHash: commitHash.trim()
      };
    } catch (error) {
      console.error('[BAMOE] Git diff error:', error);
      return {
        success: false,
        error: {
          code: 'GIT_ERROR',
          message: error instanceof Error ? error.message : 'An unknown Git error occurred'
        }
      };
    }
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
        <div id="validation-status-bar" class="validation-status-bar" title="Click to open Compliance panel">
          <span class="validation-icon">✓</span>
          <span class="validation-text">Validating...</span>
        </div>
      </div>
      <div id="properties-panel-wrapper" class="properties-panel-wrapper">
        <div id="properties-resize-handle" class="properties-resize-handle"></div>
        <div id="properties-panel" class="properties-panel"></div>
      </div>
    </div>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
