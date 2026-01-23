/**
 * Project Detection Utilities
 * Detects project settings from pom.xml and other project files
 */

import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Project information extracted from project files
 */
export interface ProjectInfo {
  groupId: string;
  artifactId: string;
  version: string;
  basePackage: string;
  projectRoot: string;
}

/**
 * Default project info when no pom.xml is found
 */
const DEFAULT_PROJECT_INFO: ProjectInfo = {
  groupId: 'com.example',
  artifactId: 'workflow',
  version: '1.0.0',
  basePackage: 'com.example.payload',
  projectRoot: ''
};

/**
 * Parse pom.xml to extract project information
 */
export async function getProjectInfo(workspaceFolder?: vscode.Uri): Promise<ProjectInfo> {
  const folder = workspaceFolder || vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!folder) {
    return { ...DEFAULT_PROJECT_INFO };
  }

  const pomPath = vscode.Uri.joinPath(folder, 'pom.xml');

  try {
    const pomContent = await vscode.workspace.fs.readFile(pomPath);
    const pomXml = Buffer.from(pomContent).toString('utf-8');

    const groupId = extractXmlValue(pomXml, 'groupId') || DEFAULT_PROJECT_INFO.groupId;
    const artifactId = extractXmlValue(pomXml, 'artifactId') || DEFAULT_PROJECT_INFO.artifactId;
    const version = extractXmlValue(pomXml, 'version') || DEFAULT_PROJECT_INFO.version;

    // Base package is typically groupId, but can be customized
    const basePackage = `${groupId}.payload`;

    return {
      groupId,
      artifactId,
      version,
      basePackage,
      projectRoot: folder.fsPath
    };
  } catch {
    // No pom.xml found, use defaults
    return {
      ...DEFAULT_PROJECT_INFO,
      projectRoot: folder.fsPath
    };
  }
}

/**
 * Extract value from XML tag (simple extraction without full XML parsing)
 */
function extractXmlValue(xml: string, tagName: string): string | null {
  // First try to find the tag directly under <project> (not inside <parent>)
  // Remove parent section to avoid getting parent's groupId
  const xmlWithoutParent = xml.replace(/<parent>[\s\S]*?<\/parent>/g, '');

  const regex = new RegExp(`<${tagName}>([^<]+)</${tagName}>`, 'i');
  const match = xmlWithoutParent.match(regex);

  if (match && match[1]) {
    return match[1].trim();
  }

  // Fallback to original XML if not found (might be inherited from parent)
  const fallbackMatch = xml.match(regex);
  return fallbackMatch ? fallbackMatch[1].trim() : null;
}

/**
 * Get the Java source directory path
 */
export function getJavaSourcePath(projectRoot: string): string {
  return path.join(projectRoot, 'src', 'main', 'java');
}

/**
 * Convert package name to directory path
 */
export function packageToPath(packageName: string): string {
  return packageName.replace(/\./g, path.sep);
}

/**
 * Get full path for a Java class file
 */
export function getJavaClassPath(
  projectRoot: string,
  packageName: string,
  className: string
): string {
  const javaSourcePath = getJavaSourcePath(projectRoot);
  const packagePath = packageToPath(packageName);
  return path.join(javaSourcePath, packagePath, `${className}.java`);
}

/**
 * Check if JsonPath dependency exists in pom.xml
 */
export async function hasJsonPathDependency(workspaceFolder?: vscode.Uri): Promise<boolean> {
  const folder = workspaceFolder || vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!folder) {
    return false;
  }

  const pomPath = vscode.Uri.joinPath(folder, 'pom.xml');

  try {
    const pomContent = await vscode.workspace.fs.readFile(pomPath);
    const pomXml = Buffer.from(pomContent).toString('utf-8');

    // Check for json-path dependency
    return pomXml.includes('json-path') || pomXml.includes('jayway');
  } catch {
    return false;
  }
}

/**
 * Generate pom.xml snippet for json-path dependency
 */
export function getJsonPathDependencySnippet(): string {
  return `
    <!-- Required for payload JSONPath expressions -->
    <dependency>
      <groupId>com.jayway.jsonpath</groupId>
      <artifactId>json-path</artifactId>
      <version>2.9.0</version>
    </dependency>`;
}
