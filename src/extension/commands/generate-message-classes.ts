/**
 * Generate Message Classes Command
 * Scans BPMN files for message events with payload definitions
 * and generates Java data classes for Kogito runtime
 */

import * as vscode from 'vscode';
import * as path from 'path';
import {
  getProjectInfo,
  getJavaClassPath
} from '../utils/project-utils';
import { PayloadFieldDefinition } from '../utils/java-generator';
import {
  generateKafkaConsumerClass,
  generateKafkaConfigSnippet,
  getConsumerClassName,
  KafkaConsumerConfig
} from '../utils/kafka-consumer-generator';

/**
 * Type of message event in the BPMN process
 */
export type MessageEventType = 'start' | 'intermediateCatch' | 'boundary' | 'receiveTask';

/**
 * Message event info extracted from BPMN
 */
export interface MessageEventInfo {
  eventId: string;
  messageName: string;
  fields: PayloadFieldDefinition[];
  bpmnFile: string;
  cloudEvents?: boolean;
  eventType: MessageEventType;
  processId?: string;
}

/**
 * Parse BPMN XML to extract message events and receive tasks with payload definitions
 */
function extractMessageEvents(bpmnXml: string, bpmnFile: string): MessageEventInfo[] {
  const events: MessageEventInfo[] = [];

  // Extract process ID from BPMN
  const processMatch = bpmnXml.match(/<bpmn:process[^>]*id="([^"]+)"/i);
  const processId = processMatch ? processMatch[1] : 'process';

  // Find all message event definitions
  // Pattern matches Start/Intermediate Catch events with MessageEventDefinition
  const eventPattern = /<bpmn:(startEvent|intermediateCatchEvent|boundaryEvent)[^>]*id="([^"]+)"[^>]*>[\s\S]*?<\/bpmn:\1>/gi;

  let eventMatch;
  while ((eventMatch = eventPattern.exec(bpmnXml)) !== null) {
    const eventBlock = eventMatch[0];
    const bpmnEventType = eventMatch[1]; // startEvent, intermediateCatchEvent, or boundaryEvent
    const eventId = eventMatch[2];

    // Check if this is a message event
    if (!eventBlock.includes('bpmn:messageEventDefinition')) {
      continue;
    }

    // Map BPMN element type to our event type
    let eventType: MessageEventType;
    switch (bpmnEventType) {
      case 'startEvent':
        eventType = 'start';
        break;
      case 'intermediateCatchEvent':
        eventType = 'intermediateCatch';
        break;
      case 'boundaryEvent':
        eventType = 'boundary';
        break;
      default:
        eventType = 'intermediateCatch';
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

    // Extract CloudEvents flag from PayloadDefinition (default true)
    const cloudEvents = extractCloudEventsFlag(eventBlock);

    // Extract payload fields from extension elements
    const fields = extractPayloadFields(eventBlock);

    // Only include events that have payload fields defined
    if (fields.length > 0) {
      events.push({
        eventId,
        messageName,
        fields,
        bpmnFile,
        cloudEvents,
        eventType,
        processId
      });
    }
  }

  // Also scan for receive tasks (which can consume Kafka messages)
  const receiveTaskPattern = /<bpmn:receiveTask[^>]*id="([^"]+)"[^>]*>[\s\S]*?<\/bpmn:receiveTask>/gi;

  let taskMatch;
  while ((taskMatch = receiveTaskPattern.exec(bpmnXml)) !== null) {
    const taskBlock = taskMatch[0];
    const taskId = taskMatch[1];

    // Extract message reference (if any)
    const msgRefMatch = taskBlock.match(/messageRef="([^"]+)"/);
    let messageName = `message_${taskId}`; // Default name based on task ID

    if (msgRefMatch) {
      const messageRef = msgRefMatch[1];
      // Find message name from definitions
      const messagePattern = new RegExp(`<bpmn:message[^>]*id="${messageRef}"[^>]*name="([^"]+)"`, 'i');
      const messageMatch = bpmnXml.match(messagePattern);
      if (messageMatch) {
        messageName = messageMatch[1];
      }
    }

    // Also check for Kafka topic in extension elements
    const kafkaTopicMatch = taskBlock.match(/topic="([^"]+)"/);
    if (kafkaTopicMatch) {
      messageName = kafkaTopicMatch[1];
    }

    // Extract CloudEvents flag from PayloadDefinition (default true)
    const cloudEvents = extractCloudEventsFlag(taskBlock);

    // Extract payload fields from extension elements
    const fields = extractPayloadFields(taskBlock);

    // Only include tasks that have payload fields defined
    if (fields.length > 0) {
      events.push({
        eventId: taskId,
        messageName,
        fields,
        bpmnFile,
        cloudEvents,
        eventType: 'receiveTask',
        processId
      });
    }
  }

  return events;
}

/**
 * Extract message events from a single BPMN file content
 * Exposed for use by auto-generation feature
 */
export function extractMessageEventsFromContent(bpmnXml: string, bpmnFile: string): MessageEventInfo[] {
  return extractMessageEvents(bpmnXml, bpmnFile);
}

/**
 * Extract CloudEvents flag from PayloadDefinition
 * Defaults to true if not specified
 */
function extractCloudEventsFlag(eventBlock: string): boolean {
  // Look for cloudEvents attribute in msgevt:PayloadDefinition or msgevt:payloadDefinition
  const cloudEventsMatch = eventBlock.match(/<msgevt:(?:payloadDefinition|PayloadDefinition)[^>]*cloudEvents="([^"]+)"/i);
  if (cloudEventsMatch) {
    return cloudEventsMatch[1].toLowerCase() !== 'false';
  }
  // Default to true
  return true;
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
export async function scanBpmnFiles(): Promise<MessageEventInfo[]> {
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
export async function generateJavaClasses(
  events: MessageEventInfo[],
  packageName: string,
  projectRoot: string
): Promise<{ generated: string[] }> {
  const generated: string[] = [];

  // Group events by message name (multiple events might share same message)
  const messageMap = new Map<string, MessageEventInfo>();
  for (const event of events) {
    const existing = messageMap.get(event.messageName);
    if (!existing || event.fields.length > existing.fields.length) {
      messageMap.set(event.messageName, event);
    }
  }

  // Generate Kafka consumer classes
  // These intercept messages and start processes with extracted variables
  const consumerPackage = packageName + '.consumer';
  const consumerConfigs: KafkaConsumerConfig[] = [];

  for (const [messageName, event] of messageMap) {
    const config: KafkaConsumerConfig = {
      messageName,
      processId: event.processId || 'process',
      fields: event.fields,
      cloudEvents: event.cloudEvents !== false
    };
    consumerConfigs.push(config);

    const consumerCode = generateKafkaConsumerClass(consumerPackage, config);
    const consumerClassName = getConsumerClassName(messageName);
    const consumerPath = getJavaClassPath(projectRoot, consumerPackage, consumerClassName);

    // Ensure consumer directory exists
    const consumerDir = vscode.Uri.file(path.dirname(consumerPath));
    try {
      await vscode.workspace.fs.createDirectory(consumerDir);
    } catch {
      // Directory might already exist
    }

    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(consumerPath),
      Buffer.from(consumerCode, 'utf-8')
    );
    generated.push(consumerPath);
  }

  // Generate Kafka config snippet
  if (consumerConfigs.length > 0) {
    const configSnippet = generateKafkaConfigSnippet(consumerConfigs);
    const configPath = path.join(projectRoot, 'src', 'main', 'resources', 'kafka-config.properties.snippet');

    // Ensure resources directory exists
    const resourcesDir = vscode.Uri.file(path.dirname(configPath));
    try {
      await vscode.workspace.fs.createDirectory(resourcesDir);
    } catch {
      // Directory might already exist
    }

    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(configPath),
      Buffer.from(configSnippet, 'utf-8')
    );
    generated.push(configPath);
  }

  return { generated };
}

/**
 * Update BPMN file with itemDefinition reference to generated class
 *
 * NOTE: This function no longer updates structureRef values to specific payload classes.
 * All itemDefinitions are kept as java.lang.Object to avoid type mismatch errors in Kogito.
 * Kogito validates that source and target types match in dataOutputAssociation, and using
 * java.lang.Object everywhere ensures compatibility while still allowing proper deserialization
 * at runtime via the MessagePayloadExtractor listener.
 */
export async function updateBpmnWithItemDefinition(
  _event: MessageEventInfo,
  _packageName: string
): Promise<void> {
  // No-op: We no longer update structureRef values to specific payload classes.
  // This prevents type mismatch errors like:
  // "Target variable 'message_Event_xxx':'java.lang.String' has different data type
  //  from 'event':'com.example.payload.PayloadClass' in data output assignment"
  //
  // The MessagePayloadExtractor listener handles proper deserialization of payload
  // fields at runtime, so typed structureRefs are not necessary.
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
      const { generated } = await generateJavaClasses(
        events,
        projectInfo.basePackage,
        projectInfo.projectRoot
      );

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
