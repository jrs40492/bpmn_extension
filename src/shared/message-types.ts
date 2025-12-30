/**
 * Message protocol definitions for extension <-> webview communication
 */

// DMN file information for Business Rule Task linking
export interface DmnFileInfo {
  path: string;
  name: string; // Relative file path for display
  modelName?: string; // DMN model name from <definitions name="..."> (required for Kogito/jBPM model input)
  namespace?: string; // DMN model namespace (required for Kogito/jBPM)
  decisions: Array<{
    id: string;
    name: string;
  }>;
  inputData?: Array<{
    id: string;
    name: string;
    typeRef?: string;
  }>;
  outputData?: Array<{
    decisionId: string;
    decisionName: string;
    variableName: string;
    typeRef?: string;
  }>;
}

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

export interface DmnFilesMessage {
  type: 'dmnFiles';
  files: DmnFileInfo[];
}

export type ExtensionToWebviewMessage = InitMessage | UpdateMessage | DmnFilesMessage;

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

export interface RequestDmnFilesMessage {
  type: 'requestDmnFiles';
}

export type WebviewToExtensionMessage = ReadyMessage | ChangeMessage | ValidationMessage | RequestDmnFilesMessage;

// Validation types
export interface ValidationIssue {
  id: string;
  message: string;
  category: 'error' | 'warn';
  rule: string;
}

// All messages
export type Message = ExtensionToWebviewMessage | WebviewToExtensionMessage;
