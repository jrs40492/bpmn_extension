import * as vscode from 'vscode';
import { getNonce } from './util/nonce';
import type { ExtensionToWebviewMessage, WebviewToExtensionMessage } from '../shared/message-types';

/**
 * Provider for DMN custom editors.
 * Uses CustomTextEditorProvider to leverage VS Code's TextDocument model
 * for automatic save handling and undo/redo support.
 */
export class DmnEditorProvider implements vscode.CustomTextEditorProvider {
  private static readonly viewType = 'bamoe.dmnEditor';

  /**
   * Diagnostics collection for DMN validation issues
   */
  private readonly diagnosticCollection: vscode.DiagnosticCollection;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('dmn');
  }

  /**
   * Register the provider with VS Code
   */
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new DmnEditorProvider(context);

    const providerRegistration = vscode.window.registerCustomEditorProvider(
      DmnEditorProvider.viewType,
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
            console.log('[DmnEditorProvider] Received change message');
            console.log('[DmnEditorProvider] message.xml length:', message.xml.length);
            console.log('[DmnEditorProvider] lastKnownXml length:', lastKnownXml.length);
            console.log('[DmnEditorProvider] xml === lastKnownXml:', message.xml === lastKnownXml);
            if (message.xml === lastKnownXml) {
              console.log('[DmnEditorProvider] Skipping change - same as lastKnownXml');
              break;
            }
            console.log('[DmnEditorProvider] Updating document with new XML');
            // Check if variable element is in the XML
            if (message.xml.includes('variable')) {
              console.log('[DmnEditorProvider] New XML contains "variable" element');
            } else {
              console.log('[DmnEditorProvider] New XML does NOT contain "variable" element');
            }
            lastKnownXml = message.xml;
            skipDocumentChangeCount++;
            await this.updateTextDocument(document, message.xml);
            console.log('[DmnEditorProvider] Document updated');
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

      // Update our tracking and send to webview
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
  private updateDiagnostics(uri: vscode.Uri, issues: Array<{ id: string; message: string; category: string; rule: string }>): void {
    const diagnostics = issues.map(issue => {
      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 0),
        `[${issue.rule}] ${issue.message}`,
        issue.category === 'error'
          ? vscode.DiagnosticSeverity.Error
          : vscode.DiagnosticSeverity.Warning
      );
      diagnostic.source = 'dmn';
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
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'dmn-webview.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'dmn-webview.css')
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
  <title>DMN Editor</title>
</head>
<body>
  <div class="dmn-editor-container">
    <div class="dmn-toolbar">
      <div class="toolbar-group">
        <span class="toolbar-title">DMN Decision Editor</span>
      </div>
      <div class="toolbar-group toolbar-tabs" id="view-tabs">
        <!-- Tabs will be dynamically created -->
      </div>
      <div class="toolbar-group">
        <button id="btn-feel-ref" class="toolbar-btn" title="FEEL Quick Reference">FEEL</button>
      </div>
      <div class="toolbar-group">
        <button id="btn-zoom-in" class="toolbar-btn" title="Zoom In">+</button>
        <button id="btn-zoom-out" class="toolbar-btn" title="Zoom Out">−</button>
        <button id="btn-zoom-fit" class="toolbar-btn" title="Fit to Viewport">Fit</button>
      </div>
    </div>
    <div class="dmn-editor-main">
      <div id="dmn-canvas" class="dmn-canvas"></div>
      <div id="dmn-properties" class="dmn-properties-panel"></div>
    </div>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
