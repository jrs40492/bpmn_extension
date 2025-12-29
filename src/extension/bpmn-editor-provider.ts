import * as vscode from 'vscode';
import { getNonce } from './util/nonce';
import { Disposable, disposeAll } from './util/dispose';
import type { ExtensionToWebviewMessage, WebviewToExtensionMessage, ValidationIssue } from '../shared/message-types';

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

    // Clean up when the editor is closed
    webviewPanel.onDidDispose(() => {
      messageHandler.dispose();
      documentChangeHandler.dispose();
      this.diagnosticCollection.delete(document.uri);
    });
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
