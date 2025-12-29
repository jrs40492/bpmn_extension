/**
 * Message protocol definitions for extension <-> webview communication
 */

// Extension -> Webview messages
export interface InitMessage {
  type: 'init';
  xml: string;
  isUntitled: boolean;
}

export interface UpdateMessage {
  type: 'update';
  xml: string;
}

export type ExtensionToWebviewMessage = InitMessage | UpdateMessage;

// Webview -> Extension messages
export interface ReadyMessage {
  type: 'ready';
}

export interface ChangeMessage {
  type: 'change';
  xml: string;
}

export interface ValidationMessage {
  type: 'validation';
  issues: ValidationIssue[];
}

export type WebviewToExtensionMessage = ReadyMessage | ChangeMessage | ValidationMessage;

// Validation types
export interface ValidationIssue {
  id: string;
  message: string;
  category: 'error' | 'warn';
  rule: string;
}

// All messages
export type Message = ExtensionToWebviewMessage | WebviewToExtensionMessage;
