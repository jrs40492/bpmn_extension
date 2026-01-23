/**
 * Generate Message Classes Command
 * Scans BPMN files for message events with payload definitions
 * and generates Java data classes for Kogito runtime
 */

import * as vscode from 'vscode';
import * as path from 'path';
import {
  getProjectInfo,
  getJavaClassPath,
  hasJsonPathDependency,
  getJsonPathDependencySnippet
} from '../utils/project-utils';
import {
  PayloadFieldDefinition,
  generatePayloadClass,
  generateDeserializerClass,
  generateClassName,
  requiresCustomDeserializer,
  requiresJsonPathLibrary,
  generatePayloadExtractorListener,
  MessageEventConfig
} from '../utils/java-generator';

/**
 * Message event info extracted from BPMN
 */
interface MessageEventInfo {
  eventId: string;
  messageName: string;
  fields: PayloadFieldDefinition[];
  bpmnFile: string;
}

/**
 * Parse BPMN XML to extract message events with payload definitions
 */
function extractMessageEvents(bpmnXml: string, bpmnFile: string): MessageEventInfo[] {
  const events: MessageEventInfo[] = [];

  // Find all message event definitions
  // Pattern matches Start/Intermediate Catch events with MessageEventDefinition
  const eventPattern = /<bpmn:(startEvent|intermediateCatchEvent|boundaryEvent)[^>]*id="([^"]+)"[^>]*>[\s\S]*?<\/bpmn:\1>/gi;

  let eventMatch;
  while ((eventMatch = eventPattern.exec(bpmnXml)) !== null) {
    const eventBlock = eventMatch[0];
    const eventId = eventMatch[2];

    // Check if this is a message event
    if (!eventBlock.includes('bpmn:messageEventDefinition')) {
      continue;
    }

    // Extract message reference
    const msgRefMatch = eventBlock.match(/messageRef="([^"]+)"/);
    if (!msgRefMatch) {
      continue;
    }
    const messageRef = msgRefMatch[1];

    // Find message name from definitions
    const messagePattern = new RegExp(`<bpmn:message[^>]*id="${messageRef}"[^>]*name="([^"]+)"`, 'i');
    const messageMatch = bpmnXml.match(messagePattern);
    const messageName = messageMatch ? messageMatch[1] : messageRef;

    // Extract payload fields from extension elements
    const fields = extractPayloadFields(eventBlock);

    // Only include events that have payload fields defined
    if (fields.length > 0) {
      events.push({
        eventId,
        messageName,
        fields,
        bpmnFile
      });
    }
  }

  return events;
}

/**
 * Extract payload field definitions from event extension elements
 */
function extractPayloadFields(eventBlock: string): PayloadFieldDefinition[] {
  const fields: PayloadFieldDefinition[] = [];

  // Look for msgevt:PayloadDefinition
  const payloadDefMatch = eventBlock.match(/<msgevt:payloadDefinition[^>]*>([\s\S]*?)<\/msgevt:payloadDefinition>/i);
  if (!payloadDefMatch) {
    // Also try self-closing with fields attribute
    const selfClosingMatch = eventBlock.match(/<msgevt:PayloadDefinition[^>]*>/gi);
    if (!selfClosingMatch) {
      return fields;
    }
  }

  let fieldMatch;
  const searchBlock = payloadDefMatch ? payloadDefMatch[1] : eventBlock;

  // Use a flexible pattern to capture all attributes
  const fieldPattern = /<msgevt:payloadField([^>]*)(?:\/>|>)/gi;

  while ((fieldMatch = fieldPattern.exec(searchBlock)) !== null) {
    const attrString = fieldMatch[1];

    const nameMatch = attrString.match(/name="([^"]*)"/);
    const typeMatch = attrString.match(/type="([^"]*)"/);
    const exprMatch = attrString.match(/expression="([^"]*)"/);

    const name = nameMatch ? nameMatch[1] : '';
    const type = typeMatch ? typeMatch[1] : 'string';
    const expression = exprMatch ? exprMatch[1] : '';

    if (name) {
      fields.push({ name, type, expression });
    }
  }

  return fields;
}

/**
 * Scan all BPMN files in workspace and extract message events
 */
async function scanBpmnFiles(): Promise<MessageEventInfo[]> {
  const allEvents: MessageEventInfo[] = [];

  // Find all .bpmn files in workspace
  const bpmnFiles = await vscode.workspace.findFiles('**/*.bpmn', '**/node_modules/**');

  for (const file of bpmnFiles) {
    try {
      const content = await vscode.workspace.fs.readFile(file);
      const bpmnXml = Buffer.from(content).toString('utf-8');
      const events = extractMessageEvents(bpmnXml, file.fsPath);
      allEvents.push(...events);
    } catch (error) {
      console.error(`Error reading ${file.fsPath}:`, error);
    }
  }

  return allEvents;
}

/**
 * Generate Java classes for message events
 */
async function generateJavaClasses(
  events: MessageEventInfo[],
  packageName: string,
  projectRoot: string
): Promise<{ generated: string[]; needsJsonPath: boolean }> {
  const generated: string[] = [];
  let needsJsonPath = false;

  // Group events by message name (multiple events might share same message)
  const messageMap = new Map<string, MessageEventInfo>();
  for (const event of events) {
    const existing = messageMap.get(event.messageName);
    if (!existing || event.fields.length > existing.fields.length) {
      messageMap.set(event.messageName, event);
    }
  }

  for (const [messageName, event] of messageMap) {
    const className = generateClassName(messageName);

    // Generate payload class
    const payloadCode = generatePayloadClass(packageName, className, event.fields);
    const payloadPath = getJavaClassPath(projectRoot, packageName, className);

    // Ensure directory exists
    const dir = vscode.Uri.file(path.dirname(payloadPath));
    try {
      await vscode.workspace.fs.createDirectory(dir);
    } catch {
      // Directory might already exist
    }

    // Write payload class
    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(payloadPath),
      Buffer.from(payloadCode, 'utf-8')
    );
    generated.push(payloadPath);

    // Generate deserializer if needed
    if (requiresCustomDeserializer(event.fields)) {
      // Only set needsJsonPath if deserializer actually uses JsonPath (not just simple field access)
      if (requiresJsonPathLibrary(event.fields)) {
        needsJsonPath = true;
      }
      const deserializerCode = generateDeserializerClass(packageName, className, event.fields);
      const deserializerPath = getJavaClassPath(projectRoot, packageName, `${className}Deserializer`);

      await vscode.workspace.fs.writeFile(
        vscode.Uri.file(deserializerPath),
        Buffer.from(deserializerCode, 'utf-8')
      );
      generated.push(deserializerPath);
    }
  }

  // Generate the MessagePayloadExtractor listener
  // This automatically sets process variables from payload fields
  const eventConfigs: MessageEventConfig[] = events.map(event => ({
    eventId: event.eventId,
    messageName: event.messageName,
    payloadClassName: `${packageName}.${generateClassName(event.messageName)}`,
    fields: event.fields
  }));

  if (eventConfigs.length > 0) {
    const listenerCode = generatePayloadExtractorListener(packageName, eventConfigs);
    const listenerPath = getJavaClassPath(projectRoot, packageName, 'MessagePayloadExtractor');

    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(listenerPath),
      Buffer.from(listenerCode, 'utf-8')
    );
    generated.push(listenerPath);
  }

  return { generated, needsJsonPath };
}

/**
 * Update BPMN file with itemDefinition reference to generated class
 * Also updates related itemDefinitions for dataOutputs and process variables
 */
async function updateBpmnWithItemDefinition(
  event: MessageEventInfo,
  packageName: string
): Promise<void> {
  const className = generateClassName(event.messageName);
  const fullClassName = `${packageName}.${className}`;

  try {
    const content = await vscode.workspace.fs.readFile(vscode.Uri.file(event.bpmnFile));
    let bpmnXml = Buffer.from(content).toString('utf-8');

    // Find the message element
    const messagePattern = new RegExp(
      `(<bpmn:message[^>]*id="[^"]*"[^>]*name="${escapeRegex(event.messageName)}"[^>]*)(\\/?>)`,
      'i'
    );

    const messageMatch = bpmnXml.match(messagePattern);
    if (!messageMatch) {
      return; // Message not found
    }

    // Check if itemRef already exists
    if (messageMatch[1].includes('itemRef=')) {
      // Update existing itemRef's structureRef
      const itemRefMatch = messageMatch[1].match(/itemRef="([^"]+)"/);
      if (itemRefMatch) {
        const itemDefId = itemRefMatch[1];
        // Find and update the itemDefinition
        const itemDefPattern = new RegExp(
          `(<bpmn:itemDefinition[^>]*id="${escapeRegex(itemDefId)}"[^>]*)structureRef="[^"]*"`,
          'i'
        );
        bpmnXml = bpmnXml.replace(itemDefPattern, `$1structureRef="${fullClassName}"`);
      }
    } else {
      // Create new itemDefinition and add itemRef
      const itemDefId = `_${event.messageName.replace(/[^a-zA-Z0-9]/g, '_')}_PayloadItem`;

      // Create itemDefinition element
      const itemDef = `  <bpmn:itemDefinition id="${itemDefId}" structureRef="${fullClassName}" />\n`;

      // Add itemDefinition before the first message or process
      const insertPoint = bpmnXml.match(/<bpmn:(message|process)/i);
      if (insertPoint && insertPoint.index !== undefined) {
        bpmnXml = bpmnXml.slice(0, insertPoint.index) + itemDef + bpmnXml.slice(insertPoint.index);
      }

      // Add itemRef to the message
      const updatedMessage = messageMatch[1] + ` itemRef="${itemDefId}"` + messageMatch[2];
      bpmnXml = bpmnXml.replace(messagePattern, updatedMessage);
    }

    // Update related itemDefinitions for the event's dataOutputs and process variables
    // These are auto-generated by BAMOE and need to have consistent types
    const eventId = event.eventId;

    // Update _Event_xxx_OutputItem (dataOutput for the whole event)
    const outputItemPattern = new RegExp(
      `(<bpmn:itemDefinition[^>]*id="_${escapeRegex(eventId)}_OutputItem"[^>]*)structureRef="[^"]*"`,
      'gi'
    );
    bpmnXml = bpmnXml.replace(outputItemPattern, `$1structureRef="${fullClassName}"`);

    // Update _message_Event_xxxItem (process variable for message data)
    const msgVarItemPattern = new RegExp(
      `(<bpmn:itemDefinition[^>]*id="_message_${escapeRegex(eventId)}Item"[^>]*)structureRef="[^"]*"`,
      'gi'
    );
    bpmnXml = bpmnXml.replace(msgVarItemPattern, `$1structureRef="${fullClassName}"`);

    // Update drools:dtype on the event's dataOutput
    const dtypePattern = new RegExp(
      `(<bpmn:dataOutput[^>]*id="${escapeRegex(eventId)}_OutputX"[^>]*)drools:dtype="[^"]*"`,
      'gi'
    );
    bpmnXml = bpmnXml.replace(dtypePattern, `$1drools:dtype="${fullClassName}"`);

    // Write updated BPMN
    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(event.bpmnFile),
      Buffer.from(bpmnXml, 'utf-8')
    );
  } catch (error) {
    console.error(`Error updating BPMN file ${event.bpmnFile}:`, error);
  }
}

/**
 * Escape special characters for use in regex
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Main command handler
 */
export async function generateMessageClasses(): Promise<void> {
  // Show progress
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Generating Message Classes',
      cancellable: false
    },
    async (progress) => {
      progress.report({ message: 'Scanning BPMN files...' });

      // Scan for message events
      const events = await scanBpmnFiles();

      if (events.length === 0) {
        vscode.window.showInformationMessage(
          'No message events with payload definitions found. Define payload fields on Start/Catch Message Events first.'
        );
        return;
      }

      progress.report({ message: `Found ${events.length} message event(s)...` });

      // Get project info
      const projectInfo = await getProjectInfo();

      if (!projectInfo.projectRoot) {
        vscode.window.showErrorMessage('No workspace folder found. Please open a folder first.');
        return;
      }

      progress.report({ message: 'Generating Java classes...' });

      // Generate classes
      const { generated, needsJsonPath } = await generateJavaClasses(
        events,
        projectInfo.basePackage,
        projectInfo.projectRoot
      );

      // Update BPMN files with itemDefinition references
      progress.report({ message: 'Updating BPMN files...' });

      for (const event of events) {
        await updateBpmnWithItemDefinition(event, projectInfo.basePackage);
      }

      // Check if json-path dependency is needed
      if (needsJsonPath) {
        const hasJsonPath = await hasJsonPathDependency();
        if (!hasJsonPath) {
          const action = await vscode.window.showWarningMessage(
            'Some payload fields use nested JSONPath expressions. Add json-path dependency to pom.xml?',
            'Show Snippet',
            'Dismiss'
          );

          if (action === 'Show Snippet') {
            const doc = await vscode.workspace.openTextDocument({
              content: getJsonPathDependencySnippet(),
              language: 'xml'
            });
            await vscode.window.showTextDocument(doc);
          }
        }
      }

      // Show success message
      const relativePaths = generated.map(p =>
        path.relative(projectInfo.projectRoot, p)
      );

      vscode.window.showInformationMessage(
        `Generated ${generated.length} Java class(es):\n${relativePaths.join('\n')}`,
        'Open Folder'
      ).then(action => {
        if (action === 'Open Folder' && generated.length > 0) {
          const folderPath = path.dirname(generated[0]);
          vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(folderPath));
        }
      });
    }
  );
}

/**
 * Register the command
 */
export function registerGenerateMessageClassesCommand(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('bamoe.generateMessageClasses', generateMessageClasses)
  );
}
