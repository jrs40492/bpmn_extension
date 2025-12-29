import type { ExtensionToWebviewMessage, WebviewToExtensionMessage } from '../shared/message-types';

/**
 * VS Code API interface
 */
interface VSCodeAPI {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

/**
 * Set up message handler for communication with the extension
 */
export function setupMessageHandler(
  handler: (message: ExtensionToWebviewMessage) => void | Promise<void>
): void {
  window.addEventListener('message', async (event) => {
    const message = event.data as ExtensionToWebviewMessage;
    try {
      await handler(message);
    } catch (err) {
      console.error('Error handling message:', err);
    }
  });
}

/**
 * Post a message to the extension
 */
export function postMessage(vscode: VSCodeAPI, message: WebviewToExtensionMessage): void {
  vscode.postMessage(message);
}
