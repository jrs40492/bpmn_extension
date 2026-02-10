import * as vscode from 'vscode';
import { getNonce } from './util/nonce';
import type { ExtensionToWebviewMessage, WebviewToExtensionMessage } from '../shared/message-types';

// DMN namespace helpers for 1.2/1.3 -> 1.6 interop at extension side (avoids rebuilding webview)
// DMN 1.2 can use both HTTP and HTTPS variants
const DMN12_MODEL_HTTP = 'http://www.omg.org/spec/DMN/20180521/MODEL/';
const DMN12_DMNDI_HTTP = 'http://www.omg.org/spec/DMN/20180521/DMNDI/';
const DMN12_MODEL_HTTPS = 'https://www.omg.org/spec/DMN/20180521/MODEL/';
const DMN12_DMNDI_HTTPS = 'https://www.omg.org/spec/DMN/20180521/DMNDI/';
const DMN13_MODEL = 'https://www.omg.org/spec/DMN/20191111/MODEL/';
const DMN13_DMNDI = 'https://www.omg.org/spec/DMN/20191111/DMNDI/';
const DMN16_MODEL = 'https://www.omg.org/spec/DMN/20230324/MODEL/';
const DMN16_DMNDI = 'https://www.omg.org/spec/DMN/20230324/DMNDI/';

function detectDmnSpec(xml: string): '1.6' | '1.3' | '1.2' | 'unknown' {
  if (!xml) return 'unknown';
  
  // Check for DMN 1.6 (both default xmlns="..." and prefixed xmlns:dmn="..." declarations)
  if (xml.includes(DMN16_MODEL) || xml.includes(DMN16_DMNDI)) return '1.6';
  
  // Check for DMN 1.3 (both default xmlns="..." and prefixed xmlns:dmn="..." declarations)
  if (xml.includes(DMN13_MODEL) || xml.includes(DMN13_DMNDI)) return '1.3';
  
  // Check for DMN 1.2 - both HTTP and HTTPS variants
  if (xml.includes(DMN12_MODEL_HTTP) || xml.includes(DMN12_DMNDI_HTTP) ||
      xml.includes(DMN12_MODEL_HTTPS) || xml.includes(DMN12_DMNDI_HTTPS)) {
    return '1.2';
  }
  
  // Additional check for prefixed DMN 1.2 declarations (both HTTP and HTTPS)
  if (xml.includes('xmlns:dmn="http://www.omg.org/spec/DMN/20180521/MODEL/"') || 
      xml.includes('xmlns:dmndi="http://www.omg.org/spec/DMN/20180521/DMNDI/"') ||
      xml.includes('xmlns:dmn="https://www.omg.org/spec/DMN/20180521/MODEL/"') || 
      xml.includes('xmlns:dmndi="https://www.omg.org/spec/DMN/20180521/DMNDI/"')) {
    return '1.2';
  }
  
  return 'unknown';
}

function convertNamespaces(xml: string, fromModel: string, fromDmndi: string, toModel: string, toDmndi: string): string {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let result = xml;
  
  console.log(`[DMN Conversion Debug] Converting from: ${fromModel} -> ${toModel}`);
  console.log(`[DMN Conversion Debug] Converting from: ${fromDmndi} -> ${toDmndi}`);
  
  // Convert default namespace declarations: xmlns="..."
  const modelMatches = (result.match(new RegExp(esc(fromModel), 'g')) || []).length;
  const dmndiMatches = (result.match(new RegExp(esc(fromDmndi), 'g')) || []).length;
  console.log(`[DMN Conversion Debug] Found ${modelMatches} MODEL matches, ${dmndiMatches} DMNDI matches`);
  
  result = result.replace(new RegExp(esc(fromModel), 'g'), toModel);
  result = result.replace(new RegExp(esc(fromDmndi), 'g'), toDmndi);
  
  // Convert prefixed namespace declarations: xmlns:dmn="...", xmlns:dmndi="..."
  const prefixModelPattern = `xmlns:dmn="${esc(fromModel)}"`;
  const prefixDmndiPattern = `xmlns:dmndi="${esc(fromDmndi)}"`;
  console.log(`[DMN Conversion Debug] Looking for pattern: ${prefixModelPattern}`);
  console.log(`[DMN Conversion Debug] Looking for pattern: ${prefixDmndiPattern}`);
  
  const prefixModelMatches = (result.match(new RegExp(prefixModelPattern, 'g')) || []).length;
  const prefixDmndiMatches = (result.match(new RegExp(prefixDmndiPattern, 'g')) || []).length;
  console.log(`[DMN Conversion Debug] Found ${prefixModelMatches} prefixed MODEL matches, ${prefixDmndiMatches} prefixed DMNDI matches`);
  
  // Debug: Let's see what's actually in the first 500 chars
  console.log(`[DMN Conversion Debug] First 500 chars of XML: ${result.substring(0, 500)}`);
  
  result = result.replace(new RegExp(prefixModelPattern, 'g'), `xmlns:dmn="${toModel}"`);
  result = result.replace(new RegExp(prefixDmndiPattern, 'g'), `xmlns:dmndi="${toDmndi}"`);
  
  return result;
}

function toDmn13(xml: string): string {
  // Convert DMN 1.2 to DMN 1.3 (dmn-js doesn't support 1.6)
  // Try HTTP variant first, then HTTPS if no matches
  let result = convertNamespaces(xml, DMN12_MODEL_HTTP, DMN12_DMNDI_HTTP, DMN13_MODEL, DMN13_DMNDI);
  result = convertNamespaces(result, DMN12_MODEL_HTTPS, DMN12_DMNDI_HTTPS, DMN13_MODEL, DMN13_DMNDI);
  return result;
}

function fromDmn16ToDmn13(xml: string): string {
  return convertNamespaces(xml, DMN16_MODEL, DMN16_DMNDI, DMN13_MODEL, DMN13_DMNDI);
}

function convertIfLegacy(xml: string): string {
  const spec = detectDmnSpec(xml);
  console.log(`[DMN Debug] Detected spec: ${spec} for XML length: ${xml.length}`);
  if (spec === '1.2') {
    try {
      const converted = toDmn13(xml);
      console.log(`[DMN Debug] Successfully converted ${spec} to 1.3, XML length: ${converted.length}`);
      console.log(`[DMN Debug] Original first 200 chars: ${xml.substring(0, 200)}`);
      console.log(`[DMN Debug] Converted first 200 chars: ${converted.substring(0, 200)}`);
      // Verify the conversion worked by checking for 1.3 namespaces
      const newSpec = detectDmnSpec(converted);
      console.log(`[DMN Debug] Converted XML detected as spec: ${newSpec}`);
      return converted;
    } catch (error) {
      console.error(`[DMN Debug] Failed to convert ${spec} to 1.3:`, error);
      return xml;
    }
  }
  if (spec === '1.6') {
    try {
      const converted = fromDmn16ToDmn13(xml);
      console.log(`[DMN Debug] Successfully converted 1.6 to 1.3, XML length: ${converted.length}`);
      return converted;
    } catch (error) {
      console.error(`[DMN Debug] Failed to convert 1.6 to 1.3:`, error);
      return xml;
    }
  }
  console.log(`[DMN Debug] No conversion needed for spec: ${spec}`);
  return xml;
}

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
            lastKnownXml = convertIfLegacy(document.getText());
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

      const currentXml = convertIfLegacy(document.getText());

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
    script-src 'nonce-${nonce}' ${webview.cspSource};
    style-src ${webview.cspSource} 'unsafe-inline';
    font-src ${webview.cspSource};
  ">
  <link href="${styleUri}" rel="stylesheet">
  <title>DMN Editor</title>
</head>
<body>
  <div class="editor-container">
    <div class="toolbar">
      <div class="toolbar-group">
        <button id="btn-undo" class="toolbar-btn" title="Undo (Ctrl+Z)">
          <span class="toolbar-icon">↩</span>
        </button>
        <button id="btn-redo" class="toolbar-btn" title="Redo (Ctrl+Y)">
          <span class="toolbar-icon">↪</span>
        </button>
      </div>
      <div class="toolbar-group">
        <div class="toolbar-tabs" id="view-tabs"></div>
      </div>
      <div class="toolbar-group">
        <button id="btn-search" class="toolbar-btn" title="Search (Ctrl+F)">
          <span class="toolbar-icon">🔍</span>
          <span class="toolbar-label">Search</span>
        </button>
        <button id="btn-test" class="toolbar-btn" title="Test Decision">
          <span class="toolbar-icon">🧪</span>
          <span class="toolbar-label">Test</span>
        </button>
        <button id="btn-feel-ref" class="toolbar-btn" title="FEEL Quick Reference">
          <span class="toolbar-icon">📖</span>
          <span class="toolbar-label">FEEL</span>
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

      <div id="properties-panel-wrapper" class="properties-panel-wrapper">
        <div id="properties-resize-handle" class="properties-resize-handle" title="Resize properties panel"></div>
        <div id="properties-panel" class="dmn-properties-panel"></div>
      </div>
    </div>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
