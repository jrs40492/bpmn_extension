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

// Extension -> Webview: Result of user task form generation
export interface GenerateUserTaskFormResultMessage {
  type: 'generateUserTaskFormResult';
  success: boolean;
  filePath?: string;
  error?: string;
}

export type ExtensionToWebviewMessage = InitMessage | UpdateMessage | DmnFilesMessage | GenerateMessageClassesResultMessage | CreateDmnFileResultMessage | GitDiffResponseMessage | GenerateUserTaskFormResultMessage;

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

export interface GenerateMessageClassesMessage {
  type: 'generateMessageClasses';
}

export interface GenerateMessageClassesResultMessage {
  type: 'generateMessageClassesResult';
  success: boolean;
  generatedFiles?: string[];
  error?: string;
}

// DMN input definition for creating new DMN files
export interface DmnInputDefinition {
  name: string;       // e.g., "customerAge"
  typeRef: string;    // e.g., "number", "string", "boolean"
}

// Webview -> Extension: Request to create a new DMN file
export interface CreateDmnFileMessage {
  type: 'createDmnFile';
  fileName: string;        // e.g., "my-decision" (without .dmn extension)
  modelName: string;       // e.g., "MyDecision" (for <definitions name="...">)
  inputs: DmnInputDefinition[];
}

// Extension -> Webview: Result of DMN file creation
export interface CreateDmnFileResultMessage {
  type: 'createDmnFileResult';
  success: boolean;
  file?: DmnFileInfo;      // The newly created file info
  error?: string;
}

// Extension -> Webview: Response with git diff data
export interface GitDiffResponseMessage {
  type: 'gitDiffResponse';
  success: boolean;
  xml?: string;
  commitHash?: string;
  error?: { code: string; message: string };
}

// Webview -> Extension: Request the committed version from git
export interface RequestGitDiffMessage {
  type: 'requestGitDiff';
}

// Webview -> Extension: Request to generate form files for a user task
export interface GenerateUserTaskFormMessage {
  type: 'generateUserTaskForm';
  taskId: string;
  taskName: string;
  inputs: Array<{
    name: string;
    dtype: string;
    variable?: string;
    defaultValue?: string;
    fieldKind?: 'flat' | 'object' | 'array';
    arrayItemFields?: Array<{ name: string; dtype: string; defaultValue?: string }>;
    objectFields?: Array<{
      name: string;
      dtype: string;
      defaultValue?: string;
      fieldKind?: 'flat' | 'object' | 'array';
      arrayItemFields?: Array<{ name: string; dtype: string; defaultValue?: string }>;
    }>;
  }>;
  outputs: Array<{
    name: string;
    dtype: string;
    variable?: string;
    defaultValue?: string;
    fieldKind?: 'flat' | 'object' | 'array';
    arrayItemFields?: Array<{ name: string; dtype: string; defaultValue?: string }>;
    objectFields?: Array<{
      name: string;
      dtype: string;
      defaultValue?: string;
      fieldKind?: 'flat' | 'object' | 'array';
      arrayItemFields?: Array<{ name: string; dtype: string; defaultValue?: string }>;
    }>;
  }>;
}

export type WebviewToExtensionMessage = ReadyMessage | ChangeMessage | ValidationMessage | RequestDmnFilesMessage | GenerateMessageClassesMessage | CreateDmnFileMessage | RequestGitDiffMessage | GenerateUserTaskFormMessage;

// Validation types
export interface ValidationIssue {
  id: string;
  message: string;
  category: 'error' | 'warn';
  rule: string;
}

// All messages
export type Message = ExtensionToWebviewMessage | WebviewToExtensionMessage;
