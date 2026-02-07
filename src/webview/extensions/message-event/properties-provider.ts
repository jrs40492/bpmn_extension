/**
 * Message Event Properties Provider
 * Adds properties panel configuration for Start Message Events
 *
 * Features:
 * - Message name configuration (creates/updates bpmn:message at definitions level)
 * - Payload fields definition (stored in msgevt:PayloadDefinition extension)
 * - Output mappings (creates bpmn:dataOutput and bpmn:dataOutputAssociation)
 */

// Type definitions for properties panel components
// @ts-expect-error - no type definitions available
import type { ListGroup as ListGroupFn, TextFieldEntry as TextFieldEntryFn, SelectEntry as SelectEntryFn, CheckboxEntry as CheckboxEntryFn } from '@bpmn-io/properties-panel';
// @ts-expect-error - no type definitions available
import type { useService as useServiceFn } from 'bpmn-js-properties-panel';

// @ts-expect-error - no type definitions available
import { ListGroup, TextFieldEntry, SelectEntry, CheckboxEntry } from '@bpmn-io/properties-panel';
// @ts-expect-error - no type definitions available
import { useService } from 'bpmn-js-properties-panel';

// Extended types for properties panel entries that include runtime-supported properties
interface ExtendedTextFieldEntryProps {
  id: string;
  element: unknown;
  label: string;
  description?: string;
  getValue: () => string;
  setValue: (value: string) => void;
  debounce?: unknown;
}

interface ExtendedSelectEntryProps {
  id: string;
  element: unknown;
  label: string;
  description?: string;
  getValue: () => string;
  setValue: (value: string) => void;
  getOptions: () => Array<{ value: string; label: string }>;
}

interface ExtendedCheckboxEntryProps {
  id: string;
  element: unknown;
  label: string;
  description?: string;
  getValue: () => boolean;
  setValue: (value: boolean) => void;
}

// ============================================================================
// Type Definitions
// ============================================================================

interface ModdleElement {
  $type: string;
  $parent?: ModdleElement;
  id?: string;
  name?: string;
  get?: (key: string) => unknown;
  set?: (key: string, value: unknown) => void;
}

interface MessageEventDefinition extends ModdleElement {
  messageRef?: Message;
}

interface Message extends ModdleElement {
  name?: string;
}

interface PayloadField extends ModdleElement {
  name?: string;
  type?: string;
  expression?: string;
}

interface PayloadDefinition extends ModdleElement {
  cloudEvents?: boolean;
  fields?: PayloadField[];
}

interface ExtensionElements extends ModdleElement {
  values?: ModdleElement[];
}

interface DataOutput extends ModdleElement {
  itemSubjectRef?: ModdleElement;
}

interface DataOutputAssociation extends ModdleElement {
  sourceRef?: DataOutput[];
  targetRef?: ModdleElement;
}

interface IoSpecification extends ModdleElement {
  dataOutputs?: DataOutput[];
  outputSets?: ModdleElement[];
}

interface BusinessObject extends ModdleElement {
  eventDefinitions?: ModdleElement[];
  extensionElements?: ExtensionElements;
  ioSpecification?: IoSpecification;
  dataOutputAssociations?: DataOutputAssociation[];
}

interface BpmnElement {
  businessObject?: BusinessObject;
}

interface Definitions extends ModdleElement {
  rootElements?: ModdleElement[];
}

interface BpmnFactory {
  create(type: string, properties?: Record<string, unknown>): ModdleElement;
}

interface CommandStack {
  execute(command: string, context: Record<string, unknown>): void;
}

interface EventBus {
  on(event: string, callback: (event: SelectionChangedEvent) => void): void;
}

interface PropertiesPanel {
  registerProvider(priority: number, provider: unknown): void;
}

interface SelectionChangedEvent {
  newSelection?: BpmnElement[];
}

interface PropertyEntry {
  id: string;
  component: (props: { element: BpmnElement; id: string }) => unknown;
  isEdited?: () => boolean;
}

interface PropertiesGroup {
  id: string;
  label?: string;
  entries?: PropertyEntry[];
  component?: unknown;
  items?: unknown[];
  add?: (event: Event) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if element is a Start Message Event
 */
function isStartMessageEvent(element: BpmnElement): boolean {
  const bo = element?.businessObject;
  if (!bo) return false;
  if (bo.$type !== 'bpmn:StartEvent') return false;

  const eventDefinitions = bo.eventDefinitions || [];
  return eventDefinitions.some((ed: ModdleElement) => ed.$type === 'bpmn:MessageEventDefinition');
}

/**
 * Check if element is an Intermediate Catch Message Event
 */
function isIntermediateCatchMessageEvent(element: BpmnElement): boolean {
  const bo = element?.businessObject;
  if (!bo) return false;
  if (bo.$type !== 'bpmn:IntermediateCatchEvent') return false;

  const eventDefinitions = bo.eventDefinitions || [];
  return eventDefinitions.some((ed: ModdleElement) => ed.$type === 'bpmn:MessageEventDefinition');
}

/**
 * Check if element is an Intermediate Throw Message Event
 */
function isIntermediateThrowMessageEvent(element: BpmnElement): boolean {
  const bo = element?.businessObject;
  if (!bo) return false;
  if (bo.$type !== 'bpmn:IntermediateThrowEvent') return false;

  const eventDefinitions = bo.eventDefinitions || [];
  return eventDefinitions.some((ed: ModdleElement) => ed.$type === 'bpmn:MessageEventDefinition');
}

/**
 * Check if element is an End Message Event
 */
function isEndMessageEvent(element: BpmnElement): boolean {
  const bo = element?.businessObject;
  if (!bo) return false;
  if (bo.$type !== 'bpmn:EndEvent') return false;

  const eventDefinitions = bo.eventDefinitions || [];
  return eventDefinitions.some((ed: ModdleElement) => ed.$type === 'bpmn:MessageEventDefinition');
}

/**
 * Check if element is a Boundary Message Event
 */
function isBoundaryMessageEvent(element: BpmnElement): boolean {
  const bo = element?.businessObject;
  if (!bo) return false;
  if (bo.$type !== 'bpmn:BoundaryEvent') return false;

  const eventDefinitions = bo.eventDefinitions || [];
  return eventDefinitions.some((ed: ModdleElement) => ed.$type === 'bpmn:MessageEventDefinition');
}

/**
 * Check if element is a Receive Task
 * Receive Tasks can also consume messages (e.g., Kafka messages) and may need payload extraction
 */
function isReceiveTask(element: BpmnElement): boolean {
  const bo = element?.businessObject;
  if (!bo) return false;
  return bo.$type === 'bpmn:ReceiveTask';
}

/**
 * Check if element is any type of Message Event
 */
function isMessageEvent(element: BpmnElement): boolean {
  return isStartMessageEvent(element) ||
    isIntermediateCatchMessageEvent(element) ||
    isIntermediateThrowMessageEvent(element) ||
    isEndMessageEvent(element) ||
    isBoundaryMessageEvent(element);
}

/**
 * Check if element is any type that can receive messages and needs payload extraction
 * This includes message catch events and receive tasks
 */
function isMessageReceiver(element: BpmnElement): boolean {
  return isStartMessageEvent(element) ||
    isIntermediateCatchMessageEvent(element) ||
    isBoundaryMessageEvent(element) ||
    isReceiveTask(element);
}

/**
 * Get the message event definition from any message event
 */
function getMessageEventDefinition(element: BpmnElement): MessageEventDefinition | null {
  const bo = element?.businessObject;
  if (!bo) return null;

  const eventDefinitions = bo.eventDefinitions || [];
  return eventDefinitions.find((ed: ModdleElement) => ed.$type === 'bpmn:MessageEventDefinition') as MessageEventDefinition || null;
}

/**
 * Get the definitions element (root of BPMN document)
 */
function getDefinitions(element: BpmnElement): Definitions {
  let current: ModdleElement | undefined = element.businessObject;
  while (current?.$parent) {
    current = current.$parent;
  }
  return current as Definitions;
}

/**
 * Get the process element from an element
 */
function getProcess(element: BpmnElement): ModdleElement | null {
  let current: ModdleElement | undefined = element.businessObject;
  while (current && current.$type !== 'bpmn:Process') {
    current = current.$parent;
  }
  return current || null;
}

/**
 * Get or create the bpmn:message element for this start message event
 */
function getOrCreateMessage(
  element: BpmnElement,
  bpmnFactory: BpmnFactory,
  commandStack: CommandStack
): Message | null {
  const msgEvtDef = getMessageEventDefinition(element);
  if (!msgEvtDef) return null;

  // Check if message already exists
  if (msgEvtDef.messageRef) {
    const existingMessage = msgEvtDef.messageRef;

    // Check if existing message has itemRef - if not, create one (required by jBPM)
    if (!(existingMessage as unknown as { itemRef?: ModdleElement }).itemRef) {
      const definitions = getDefinitions(element);
      const itemDefId = `_${existingMessage.id}_Item`;

      // Check if itemDefinition already exists
      const rootElements = definitions.rootElements || [];
      let itemDef = rootElements.find((el: ModdleElement) =>
        el.$type === 'bpmn:ItemDefinition' && el.id === itemDefId
      );

      if (!itemDef) {
        // Create itemDefinition for the message
        itemDef = bpmnFactory.create('bpmn:ItemDefinition', {
          id: itemDefId,
          structureRef: 'java.lang.Object'
        });
        itemDef.$parent = definitions;

        // Add itemDefinition to rootElements BEFORE the message that references it
        // jBPM requires itemDefinition to appear before the message in the XML
        const newRootElements = [...rootElements];
        const messageIndex = newRootElements.findIndex((el: ModdleElement) => el === existingMessage);
        if (messageIndex >= 0) {
          // Insert itemDef right before the message
          newRootElements.splice(messageIndex, 0, itemDef);
        } else {
          // Fallback: insert before process
          const processIndex = newRootElements.findIndex((el: ModdleElement) => el.$type === 'bpmn:Process');
          if (processIndex >= 0) {
            newRootElements.splice(processIndex, 0, itemDef);
          } else {
            newRootElements.push(itemDef);
          }
        }

        commandStack.execute('element.updateModdleProperties', {
          element,
          moddleElement: definitions,
          properties: { rootElements: newRootElements }
        });
      }

      // Set itemRef on the existing message
      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: existingMessage,
        properties: { itemRef: itemDef }
      });
    }

    return existingMessage;
  }

  // Create new message at definitions level
  const definitions = getDefinitions(element);
  const bo = element.businessObject;
  const messageId = `Message_${bo?.id || 'unknown'}`;
  const itemDefId = `_${messageId}_Item`;

  // Create itemDefinition for the message (required by jBPM)
  const itemDef = bpmnFactory.create('bpmn:ItemDefinition', {
    id: itemDefId,
    structureRef: 'java.lang.Object'
  });
  itemDef.$parent = definitions;

  // Use a default name based on event ID (jBPM requires non-empty message names)
  const defaultName = `message_${bo?.id || 'unknown'}`;
  const message = bpmnFactory.create('bpmn:Message', {
    id: messageId,
    name: defaultName,
    itemRef: itemDef
  }) as Message;
  message.$parent = definitions;

  // Add itemDefinition and message to definitions rootElements
  const newRootElements = [...(definitions.rootElements || [])];
  // Insert before the first process element
  const processIndex = newRootElements.findIndex((el: ModdleElement) => el.$type === 'bpmn:Process');
  if (processIndex >= 0) {
    // Insert itemDef first, then message
    newRootElements.splice(processIndex, 0, itemDef, message);
  } else {
    newRootElements.push(itemDef, message);
  }

  commandStack.execute('element.updateModdleProperties', {
    element,
    moddleElement: definitions,
    properties: { rootElements: newRootElements }
  });

  // Set messageRef on the event definition
  commandStack.execute('element.updateModdleProperties', {
    element,
    moddleElement: msgEvtDef,
    properties: { messageRef: message }
  });

  return message;
}

/**
 * Get the payload definition from extension elements
 */
function getPayloadDefinition(element: BpmnElement): PayloadDefinition | null {
  const bo = element?.businessObject;
  if (!bo) return null;

  const extensionElements = bo.extensionElements;
  if (!extensionElements) return null;

  const values = extensionElements.values || [];
  return values.find((ext: ModdleElement) => ext.$type === 'msgevt:PayloadDefinition') as PayloadDefinition || null;
}

/**
 * Get payload fields from the element
 */
function getPayloadFields(element: BpmnElement): PayloadField[] {
  const payloadDef = getPayloadDefinition(element);
  return payloadDef?.fields || [];
}

/**
 * Check if CloudEvents format is enabled for this element
 */
function isCloudEventsEnabled(element: BpmnElement): boolean {
  const payloadDef = getPayloadDefinition(element);
  return payloadDef?.cloudEvents ?? false;
}

/**
 * Build the full JSONPath expression for CloudEvents format
 * fieldName -> $.data.fieldName
 * Note: The runtime deserializer auto-detects CloudEvents vs flat JSON,
 * so we always store expressions in CloudEvents format.
 */
function buildExpression(fieldName: string): string {
  if (!fieldName) return '';
  return `$.data.${fieldName}`;
}

/**
 * Extract the simplified field name from a full JSONPath expression
 * $.data.userId -> userId (CloudEvents mode)
 * $.userId -> userId (standard mode)
 */
function extractFieldFromExpression(expression: string | undefined): string {
  if (!expression) return '';
  // Remove $.data. prefix (CloudEvents)
  if (expression.startsWith('$.data.')) {
    return expression.slice(7);
  }
  // Remove $. prefix (standard)
  if (expression.startsWith('$.')) {
    return expression.slice(2);
  }
  return expression;
}

/**
 * Ensure extension elements and payload definition exist
 */
function ensurePayloadDefinition(
  element: BpmnElement,
  bpmnFactory: BpmnFactory,
  commandStack: CommandStack
): PayloadDefinition {
  const bo = element.businessObject;
  if (!bo) {
    throw new Error('No business object');
  }

  // Ensure a message exists for jBPM compatibility
  // jBPM requires every Start Message Event to have a bpmn:Message reference
  const msgEvtDef = getMessageEventDefinition(element);
  if (msgEvtDef && !msgEvtDef.messageRef) {
    getOrCreateMessage(element, bpmnFactory, commandStack);
  }

  // Ensure extensionElements exists
  let extensionElements = bo.extensionElements;
  if (!extensionElements) {
    extensionElements = bpmnFactory.create('bpmn:ExtensionElements', { values: [] }) as ExtensionElements;
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: bo,
      properties: { extensionElements }
    });
  }

  // Check if PayloadDefinition already exists
  let payloadDef = getPayloadDefinition(element);
  if (!payloadDef) {
    payloadDef = bpmnFactory.create('msgevt:PayloadDefinition', { fields: [] }) as PayloadDefinition;
    payloadDef.$parent = extensionElements;

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: extensionElements,
      properties: {
        values: [...(extensionElements.values || []), payloadDef]
      }
    });
  }

  return payloadDef;
}

/**
 * Map Java type from simple type name
 */
function getJavaType(type: string): string {
  switch (type) {
    case 'string':
      return 'java.lang.String';
    case 'number':
      return 'java.lang.Double';
    case 'boolean':
      return 'java.lang.Boolean';
    case 'object':
      return 'java.lang.Object';
    default:
      return 'java.lang.Object';
  }
}

/**
 * Ensure itemDefinition exists at definitions level
 */
function ensureItemDefinition(
  definitions: Definitions,
  itemId: string,
  structureRef: string,
  bpmnFactory: BpmnFactory,
  element: BpmnElement,
  commandStack: CommandStack
): ModdleElement {
  const rootElements = definitions.rootElements || [];
  let itemDef = rootElements.find((el: ModdleElement) =>
    el.$type === 'bpmn:ItemDefinition' && el.id === itemId
  );

  if (!itemDef) {
    itemDef = bpmnFactory.create('bpmn:ItemDefinition', {
      id: itemId,
      structureRef: structureRef
    });
    itemDef.$parent = definitions;

    // Add to rootElements using commandStack for proper persistence
    const newRootElements = [...rootElements];
    const processIndex = newRootElements.findIndex((el: ModdleElement) => el.$type === 'bpmn:Process');
    if (processIndex >= 0) {
      newRootElements.splice(processIndex, 0, itemDef);
    } else {
      newRootElements.push(itemDef);
    }

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: definitions,
      properties: { rootElements: newRootElements }
    });
  }

  return itemDef;
}

/**
 * Ensure process property exists
 */
function ensureProcessProperty(
  element: BpmnElement,
  propertyName: string,
  bpmnFactory: BpmnFactory,
  commandStack: CommandStack
): ModdleElement | null {
  const process = getProcess(element);
  if (!process) return null;

  // Check if property already exists
  const properties = (process as unknown as { properties?: ModdleElement[] }).properties || [];
  let property = properties.find((p: ModdleElement) => p.id === propertyName || p.name === propertyName);

  if (!property) {
    // Create itemDefinition first
    const definitions = getDefinitions(element);
    const itemDefId = `_${propertyName}Item`;
    const itemDef = ensureItemDefinition(definitions, itemDefId, 'java.lang.Object', bpmnFactory, element, commandStack);

    // Create property
    property = bpmnFactory.create('bpmn:Property', {
      id: propertyName,
      name: propertyName,
      itemSubjectRef: itemDef
    });
    property.$parent = process;

    const newProperties = [...properties, property];
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: process,
      properties: { properties: newProperties }
    });
  }

  return property;
}

/**
 * Create or update data output for a payload field
 *
 * IMPORTANT: BPMN Events use dataOutputs, outputSet, and dataOutputAssociations
 * DIRECTLY on the event element (NOT inside an ioSpecification).
 * ioSpecification is only used for Activities/Tasks.
 */
function ensureDataOutput(
  element: BpmnElement,
  fieldName: string,
  fieldType: string,
  bpmnFactory: BpmnFactory,
  commandStack: CommandStack
): DataOutput | null {
  const bo = element.businessObject;
  if (!bo) return null;

  const definitions = getDefinitions(element);
  const eventId = bo.id || 'Event';
  const outputId = `${eventId}_${fieldName}`;
  const itemDefId = `_${outputId}Item`;

  // Ensure itemDefinition exists
  const itemDef = ensureItemDefinition(definitions, itemDefId, getJavaType(fieldType), bpmnFactory, element, commandStack);

  // Clean up any corrupted ioSpecification attribute (events don't use ioSpecification)
  const ioSpec = bo.ioSpecification;
  if (ioSpec) {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: bo,
      properties: { ioSpecification: undefined }
    });
  }

  // For events, dataOutputs and outputSet go directly on the event element
  // Get existing dataOutputs from the event (not from ioSpecification)
  const existingDataOutputs = (bo as unknown as { dataOutputs?: DataOutput[] }).dataOutputs || [];
  let dataOutput = existingDataOutputs.find((d: DataOutput) => d.name === fieldName) as DataOutput | undefined;

  if (!dataOutput) {
    // Create the dataOutput
    dataOutput = bpmnFactory.create('bpmn:DataOutput', {
      id: outputId,
      name: fieldName,
      itemSubjectRef: itemDef
    }) as DataOutput;
    // Set drools:dtype for Kogito compatibility
    (dataOutput as unknown as { set?: (key: string, value: string) => void }).set?.('drools:dtype', getJavaType(fieldType));
    dataOutput.$parent = bo;

    const newDataOutputs = [...existingDataOutputs, dataOutput];

    // Get or create outputSet directly on the event
    let outputSet = (bo as unknown as { outputSet?: ModdleElement }).outputSet;
    if (!outputSet) {
      outputSet = bpmnFactory.create('bpmn:OutputSet', {
        dataOutputRefs: []
      });
      outputSet.$parent = bo;
    }

    // Add dataOutput to outputSet's dataOutputRefs
    const existingRefs = (outputSet as unknown as { dataOutputRefs?: DataOutput[] }).dataOutputRefs || [];
    const newRefs = [...existingRefs, dataOutput];

    // Update the event with dataOutputs and outputSet directly (NOT ioSpecification)
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: bo,
      properties: {
        dataOutputs: newDataOutputs,
        outputSet: outputSet
      }
    });

    // Update outputSet dataOutputRefs
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: outputSet,
      properties: { dataOutputRefs: newRefs }
    });
  }

  return dataOutput;
}

/**
 * Get output mapping for a field (process variable name)
 */
function getOutputMapping(element: BpmnElement, fieldName: string): string {
  const bo = element?.businessObject;
  if (!bo) return '';

  const associations = bo.dataOutputAssociations || [];
  for (const assoc of associations) {
    // sourceRef is an array in bpmn-js
    const sourceRefArray = assoc.sourceRef;
    if (sourceRefArray && Array.isArray(sourceRefArray) && sourceRefArray.length > 0) {
      const sourceRef = sourceRefArray[0];
      if (sourceRef?.name === fieldName) {
        const targetRef = assoc.targetRef;
        if (targetRef) {
          if (typeof targetRef === 'string') {
            return targetRef;
          } else if ((targetRef as ModdleElement).name) {
            return (targetRef as ModdleElement).name!;
          } else if ((targetRef as ModdleElement).id) {
            return (targetRef as ModdleElement).id!;
          }
        }
      }
    }
  }

  return '';
}

/**
 * Set output mapping for a field
 */
function setOutputMapping(
  element: BpmnElement,
  fieldName: string,
  variableName: string,
  fieldType: string,
  bpmnFactory: BpmnFactory,
  commandStack: CommandStack
): void {
  if (!variableName || variableName === 'undefined' || variableName.trim() === '') {
    return;
  }

  const bo = element.businessObject;
  if (!bo) return;

  // Ensure the data output exists
  const dataOutput = ensureDataOutput(element, fieldName, fieldType, bpmnFactory, commandStack);
  if (!dataOutput) return;

  // Ensure the process property exists
  const propertyElement = ensureProcessProperty(element, variableName, bpmnFactory, commandStack);
  if (!propertyElement) return;

  // Check if association already exists
  const associations = bo.dataOutputAssociations || [];
  const existingAssoc = associations.find((a: DataOutputAssociation) => {
    const sourceRefArray = a.sourceRef;
    if (sourceRefArray && Array.isArray(sourceRefArray) && sourceRefArray.length > 0) {
      return sourceRefArray[0]?.name === fieldName;
    }
    return false;
  });

  if (existingAssoc) {
    // Update existing association
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: existingAssoc,
      properties: { targetRef: propertyElement }
    });
  } else {
    // Create new association
    const newAssoc = bpmnFactory.create('bpmn:DataOutputAssociation', {
      targetRef: propertyElement
    }) as DataOutputAssociation;
    (newAssoc as unknown as { sourceRef: DataOutput[] }).sourceRef = [dataOutput];
    newAssoc.$parent = bo;

    const newAssociations = [...associations, newAssoc];
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: bo,
      properties: { dataOutputAssociations: newAssociations }
    });
  }

  // NOTE: We no longer update itemDefinition.structureRef to specific payload classes.
  // This was causing type mismatch errors in Kogito validation because not all related
  // itemDefinitions were being updated consistently. Using java.lang.Object everywhere
  // ensures compatibility, and the MessagePayloadExtractor listener handles proper
  // deserialization at runtime.
}

/**
 * Get available process variables
 */
function getAvailableProcessVariables(element: BpmnElement): Array<{ id: string; name: string }> {
  const process = getProcess(element);
  if (!process) return [];

  const variables: Array<{ id: string; name: string }> = [];

  // Get variables from bpmn:property elements
  const properties = (process as unknown as { properties?: ModdleElement[] }).properties || [];
  for (const prop of properties) {
    if (prop.id || prop.name) {
      variables.push({
        id: prop.id || prop.name!,
        name: prop.name || prop.id!
      });
    }
  }

  // Get from bamoe:ProcessVariables extension
  const extensionElements = (process as unknown as { extensionElements?: ExtensionElements }).extensionElements;
  if (extensionElements?.values) {
    const processVariables = extensionElements.values.find(
      (ext: ModdleElement) => ext.$type === 'bamoe:ProcessVariables'
    );
    if (processVariables) {
      const vars = (processVariables as unknown as { variables?: ModdleElement[] }).variables || [];
      for (const v of vars) {
        if (v.name && !variables.find(existing => existing.name === v.name)) {
          variables.push({ id: v.name, name: v.name });
        }
      }
    }
  }

  return variables;
}

// ============================================================================
// Property Panel Components
// ============================================================================

/**
 * Message Name component
 */
function MessageName(props: { element: BpmnElement; id: string }) {
  const { element, id } = props;
  const commandStack = useService('commandStack') as CommandStack;
  const bpmnFactory = useService('bpmnFactory') as BpmnFactory;
  const translate = useService('translate') as (text: string) => string;
  const debounce = useService('debounceInput') as <T>(fn: T) => T;

  const getValue = () => {
    const msgEvtDef = getMessageEventDefinition(element);
    return msgEvtDef?.messageRef?.name || '';
  };

  const setValue = (value: string) => {
    const message = getOrCreateMessage(element, bpmnFactory, commandStack);
    if (message) {
      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: message,
        properties: { name: value }
      });
    }
  };

  return TextFieldEntry({
    id,
    element,
    label: translate('Message Name'),
    description: translate('Name of the message that triggers this start event'),
    getValue,
    setValue
  } as ExtendedTextFieldEntryProps);
}

/**
 * CloudEvents Toggle component
 * When enabled, expressions are automatically prefixed with $.data.
 */
function CloudEventsToggle(props: { element: BpmnElement; id: string }) {
  const { element, id } = props;
  const commandStack = useService('commandStack') as CommandStack;
  const bpmnFactory = useService('bpmnFactory') as BpmnFactory;
  const translate = useService('translate') as (text: string) => string;

  const getValue = () => {
    return isCloudEventsEnabled(element);
  };

  const setValue = (value: boolean) => {
    const payloadDef = ensurePayloadDefinition(element, bpmnFactory, commandStack);
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: payloadDef,
      properties: { cloudEvents: value }
    });

    // Update all field expressions when toggling CloudEvents mode
    const fields = payloadDef.fields || [];
    for (const field of fields) {
      if (field.name) {
        // Extract the simple field name from existing expression
        const simpleName = extractFieldFromExpression(field.expression) || field.name;
        // Rebuild the expression with the new mode
        const newExpression = buildExpression(simpleName);
        commandStack.execute('element.updateModdleProperties', {
          element,
          moddleElement: field,
          properties: { expression: newExpression }
        });
      }
    }
  };

  return CheckboxEntry({
    id,
    element,
    label: translate('CloudEvents Format'),
    description: translate('Enable for CloudEvents messages (data nested under $.data). Disable for flat JSON payloads.'),
    getValue,
    setValue
  });
}

/**
 * Payload Field Name component
 * When field name is set, also auto-sets the expression using CloudEvents format
 */
function PayloadFieldName(props: { id: string; field: PayloadField; element: BpmnElement }) {
  const { id, field } = props;
  const commandStack = useService('commandStack') as CommandStack;
  const translate = useService('translate') as (text: string) => string;
  const debounce = useService('debounceInput') as <T>(fn: T) => T;

  const getValue = () => field.name || '';

  const setValue = (value: string) => {
    const properties: Record<string, unknown> = { name: value };

    // Auto-set expression if not already set or if it matches the old name pattern
    if (value) {
      const currentExpression = field.expression || '';
      const oldName = field.name || '';

      // Auto-update expression if:
      // 1. Expression is empty
      // 2. Expression matches the old field name pattern (user hasn't customized it)
      const expectedOldExpression = buildExpression(oldName);
      if (!currentExpression || currentExpression === expectedOldExpression || currentExpression === `$.data.${oldName}`) {
        properties.expression = buildExpression(value);
      }
    }

    commandStack.execute('element.updateModdleProperties', {
      element: props.element,
      moddleElement: field,
      properties
    });
  };

  return TextFieldEntry({
    id,
    element: props.element,
    label: translate('Field Name'),
    getValue,
    setValue,
    debounce
  });
}

/**
 * Payload Field Expression component
 * User enters "userId", stored as "$.data.userId"
 * The runtime deserializer auto-detects CloudEvents vs flat JSON formats.
 */
function PayloadFieldExpression(props: { id: string; field: PayloadField; element: BpmnElement }) {
  const { id, field, element } = props;
  const commandStack = useService('commandStack') as CommandStack;
  const translate = useService('translate') as (text: string) => string;
  const debounce = useService('debounceInput') as <T>(fn: T) => T;

  const getValue = () => {
    // Show just the field name (extract from expression)
    return extractFieldFromExpression(field.expression);
  };

  const setValue = (value: string) => {
    // Auto-build the full expression using CloudEvents format
    const expression = buildExpression(value);

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: field,
      properties: { expression }
    });
  };

  return TextFieldEntry({
    id,
    element,
    label: translate('Source Field'),
    description: translate('Field name in message payload (e.g., userId)'),
    getValue,
    setValue
  } as ExtendedTextFieldEntryProps);
}

/**
 * Payload Field Type component
 */
function PayloadFieldType(props: { id: string; field: PayloadField; element: BpmnElement }) {
  const { id, field, element } = props;
  const commandStack = useService('commandStack') as CommandStack;
  const translate = useService('translate') as (text: string) => string;

  const getValue = () => field.type || 'string';

  const setValue = (value: string) => {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: field,
      properties: { type: value }
    });
  };

  const getOptions = () => [
    { value: 'string', label: translate('String') },
    { value: 'number', label: translate('Number') },
    { value: 'boolean', label: translate('Boolean') },
    { value: 'object', label: translate('Object') }
  ];

  return SelectEntry({
    id,
    element,
    label: translate('Field Type'),
    getValue,
    setValue,
    getOptions
  });
}

/**
 * Output Mapping component for a payload field
 */
function createOutputMappingComponent(field: PayloadField) {
  return function OutputMapping(props: { element: BpmnElement; id: string }) {
    const { element, id } = props;
    const commandStack = useService('commandStack') as CommandStack;
    const bpmnFactory = useService('bpmnFactory') as BpmnFactory;
    const translate = useService('translate') as (text: string) => string;

    const getValue = () => {
      if (!field.name) return '';
      return getOutputMapping(element, field.name);
    };

    const setValue = (value: string) => {
      if (!field.name) return;
      if (value && value !== 'undefined' && value.trim() !== '') {
        setOutputMapping(element, field.name, value, field.type || 'string', bpmnFactory, commandStack);
      }
    };

    const getOptions = () => {
      const options = [
        { value: '', label: translate('-- Select Variable --') }
      ];

      const variables = getAvailableProcessVariables(element);
      for (const v of variables) {
        if (v.name && v.name !== 'undefined') {
          options.push({
            value: v.name,
            label: v.name
          });
        }
      }

      return options;
    };

    return SelectEntry({
      id,
      element,
      label: translate('Map to Variable'),
      description: translate(`Map "${field.name}" to a process variable`),
      getValue,
      setValue,
      getOptions
    } as ExtendedSelectEntryProps);
  };
}

/**
 * Payload Field entry component - renders fields for a single payload field
 */
function PayloadFieldEntry(props: { idPrefix: string; field: PayloadField; element: BpmnElement }) {
  const { idPrefix, field, element } = props;

  const entries = [
    {
      id: `${idPrefix}-name`,
      component: PayloadFieldName,
      field,
      idPrefix,
      element
    },
    {
      id: `${idPrefix}-expression`,
      component: PayloadFieldExpression,
      field,
      idPrefix,
      element
    },
    {
      id: `${idPrefix}-type`,
      component: PayloadFieldType,
      field,
      idPrefix,
      element
    }
  ];

  // Add output mapping if field has a name
  if (field.name) {
    entries.push({
      id: `${idPrefix}-mapping`,
      component: createOutputMappingComponent(field),
      field,
      idPrefix,
      element
    } as typeof entries[0]);
  }

  return entries;
}

/**
 * Create handler to add a new payload field
 */
function createAddFieldHandler(bpmnFactory: BpmnFactory, commandStack: CommandStack, element: BpmnElement) {
  return function(event: Event) {
    event.stopPropagation();

    const payloadDef = ensurePayloadDefinition(element, bpmnFactory, commandStack);

    // Create new field - expression will be set when user enters field name
    const newField = bpmnFactory.create('msgevt:PayloadField', {
      name: '',
      type: 'string',
      expression: ''
    }) as PayloadField;
    newField.$parent = payloadDef;

    // Add field to list
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: payloadDef,
      properties: {
        fields: [...(payloadDef.fields || []), newField]
      }
    });
  };
}

/**
 * Create handler to remove a payload field
 */
function createRemoveFieldHandler(commandStack: CommandStack, element: BpmnElement, field: PayloadField) {
  return function(event: Event) {
    event.stopPropagation();

    const payloadDef = getPayloadDefinition(element);
    if (!payloadDef) return;

    const newFields = (payloadDef.fields || []).filter((f: PayloadField) => f !== field);

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: payloadDef,
      properties: { fields: newFields }
    });

    // Also remove the corresponding dataOutput and dataOutputAssociation
    if (field.name) {
      const bo = element.businessObject;
      if (!bo) return;

      // Remove dataOutputAssociation
      const associations = bo.dataOutputAssociations || [];
      const newAssociations = associations.filter((a: DataOutputAssociation) => {
        const sourceRefArray = a.sourceRef;
        if (sourceRefArray && Array.isArray(sourceRefArray) && sourceRefArray.length > 0) {
          return sourceRefArray[0]?.name !== field.name;
        }
        return true;
      });

      if (newAssociations.length !== associations.length) {
        commandStack.execute('element.updateModdleProperties', {
          element,
          moddleElement: bo,
          properties: { dataOutputAssociations: newAssociations }
        });
      }

      // Remove dataOutput from the event directly (events don't use ioSpecification)
      const dataOutputs = (bo as unknown as { dataOutputs?: DataOutput[] }).dataOutputs || [];
      const newDataOutputs = dataOutputs.filter((d: DataOutput) => d.name !== field.name);

      if (newDataOutputs.length !== dataOutputs.length) {
        commandStack.execute('element.updateModdleProperties', {
          element,
          moddleElement: bo,
          properties: { dataOutputs: newDataOutputs }
        });

        // Also update outputSet dataOutputRefs
        const outputSet = (bo as unknown as { outputSet?: ModdleElement }).outputSet;
        if (outputSet) {
          const dataOutputRefs = (outputSet as unknown as { dataOutputRefs?: DataOutput[] }).dataOutputRefs || [];
          const newRefs = dataOutputRefs.filter((d: DataOutput) => d.name !== field.name);
          commandStack.execute('element.updateModdleProperties', {
            element,
            moddleElement: outputSet,
            properties: { dataOutputRefs: newRefs }
          });
        }
      }
    }
  };
}

/**
 * Payload Fields List Group
 */
function PayloadFieldsGroup(props: { element: BpmnElement; injector: unknown }) {
  const { element, injector } = props;

  // Support all message receivers (message catch events and receive tasks)
  if (!isMessageReceiver(element)) {
    return null;
  }

  const bpmnFactory = (injector as { get: (name: string) => BpmnFactory }).get('bpmnFactory');
  const commandStack = (injector as { get: (name: string) => CommandStack }).get('commandStack');
  const translate = (injector as { get: (name: string) => (text: string) => string }).get('translate');

  const fields = getPayloadFields(element);

  const items = fields.map((field: PayloadField, index: number) => {
    const id = `${element.businessObject?.id || 'element'}-field-${index}`;
    return {
      id,
      label: field.name || translate('<unnamed>'),
      entries: PayloadFieldEntry({
        idPrefix: id,
        field,
        element
      }),
      autoFocusEntry: `${id}-name`,
      remove: createRemoveFieldHandler(commandStack, element, field)
    };
  });

  return {
    items,
    add: createAddFieldHandler(bpmnFactory, commandStack, element),
    label: translate('Payload Fields')
  };
}

// ============================================================================
// Properties Provider Class
// ============================================================================

// Track elements that have had their drools:dtype fixed to prevent infinite loops
const fixedDtypeElements = new WeakSet<object>();

// Track definitions that have had comprehensive cleanup performed
const cleanedUpDefinitions = new WeakSet<object>();

/**
 * Comprehensive cleanup of orphaned message-related BPMN elements.
 * This finds and removes:
 * - Orphaned itemDefinitions (with patterns like _Event_xxx_, _message_Event_xxx)
 * - Orphaned process properties (message_Event_xxx that don't correspond to existing events)
 * - Normalizes all structureRef values to java.lang.Object to prevent type mismatch errors
 *
 * @param element The currently selected element (used as context for commandStack)
 * @param definitions The BPMN definitions root element
 * @param commandStack The command stack for executing changes
 */
function cleanupOrphanedMessageElements(
  element: BpmnElement,
  definitions: Definitions,
  commandStack: CommandStack
): void {
  const rootElements = definitions.rootElements || [];
  const process = rootElements.find((el: ModdleElement) => el.$type === 'bpmn:Process');
  if (!process) return;

  // Get all actual event IDs from the process
  const flowElements = (process as unknown as { flowElements?: ModdleElement[] }).flowElements || [];
  const actualEventIds = new Set<string>();
  const actualTaskIds = new Set<string>();
  for (const el of flowElements) {
    if (el.$type?.includes('Event')) {
      actualEventIds.add(el.id || '');
    }
    if (el.$type === 'bpmn:ReceiveTask') {
      actualTaskIds.add(el.id || '');
    }
  }

  // Find orphaned itemDefinitions
  // Patterns to check:
  // - _Event_xxx_...Item (e.g., _Event_0m799to_OutputItem)
  // - _message_Event_xxxItem (e.g., _message_Event_0m799toItem)
  // - _Message_Event_xxx_Item (e.g., _Message_Event_0tyznr4_Item)
  const orphanedItemDefIds = new Set<string>();
  const orphanedMessageIds = new Set<string>();

  for (const el of rootElements) {
    if (el.$type === 'bpmn:ItemDefinition' && el.id) {
      // Check for event-related patterns
      const eventMatch = el.id.match(/_(?:message_)?(Event_[a-zA-Z0-9]+)/);
      if (eventMatch) {
        const eventId = eventMatch[1];
        if (!actualEventIds.has(eventId)) {
          orphanedItemDefIds.add(el.id);
        }
      }

      // Check for Message_Event_xxx pattern
      const msgEventMatch = el.id.match(/_Message_(Event_[a-zA-Z0-9]+)_Item/);
      if (msgEventMatch) {
        const eventId = msgEventMatch[1];
        if (!actualEventIds.has(eventId)) {
          orphanedItemDefIds.add(el.id);
        }
      }

      // Check for Activity_xxx pattern (for receive tasks)
      const activityMatch = el.id.match(/_(?:Message_)?(Activity_[a-zA-Z0-9]+)/);
      if (activityMatch) {
        const activityId = activityMatch[1];
        if (!actualTaskIds.has(activityId)) {
          orphanedItemDefIds.add(el.id);
        }
      }
    }

    // Check for orphaned messages
    if (el.$type === 'bpmn:Message' && el.id) {
      const eventMatch = el.id.match(/Message_(Event_[a-zA-Z0-9]+)/);
      if (eventMatch) {
        const eventId = eventMatch[1];
        if (!actualEventIds.has(eventId)) {
          orphanedMessageIds.add(el.id);
          // Also add the message's itemRef
          const itemRef = (el as unknown as { itemRef?: ModdleElement }).itemRef;
          if (itemRef?.id) {
            orphanedItemDefIds.add(itemRef.id);
          }
        }
      }

      const activityMatch = el.id.match(/Message_(Activity_[a-zA-Z0-9]+)/);
      if (activityMatch) {
        const activityId = activityMatch[1];
        if (!actualTaskIds.has(activityId)) {
          orphanedMessageIds.add(el.id);
          const itemRef = (el as unknown as { itemRef?: ModdleElement }).itemRef;
          if (itemRef?.id) {
            orphanedItemDefIds.add(itemRef.id);
          }
        }
      }
    }
  }

  // Remove orphaned elements from rootElements
  if (orphanedItemDefIds.size > 0 || orphanedMessageIds.size > 0) {
    const newRootElements = rootElements.filter((el: ModdleElement) =>
      !orphanedItemDefIds.has(el.id || '') && !orphanedMessageIds.has(el.id || '')
    );

    if (newRootElements.length < rootElements.length) {
      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: definitions,
        properties: { rootElements: newRootElements }
      });
    }
  }

  // Remove orphaned process properties
  const properties = (process as unknown as { properties?: ModdleElement[] }).properties || [];
  const newProperties = properties.filter((p: ModdleElement) => {
    if (!p.id) return true;

    // Check for message_Event_xxx pattern
    const eventMatch = p.id.match(/message_(Event_[a-zA-Z0-9]+)/);
    if (eventMatch) {
      return actualEventIds.has(eventMatch[1]);
    }

    // Check for message_Activity_xxx pattern
    const activityMatch = p.id.match(/message_(Activity_[a-zA-Z0-9]+)/);
    if (activityMatch) {
      return actualTaskIds.has(activityMatch[1]);
    }

    return true;
  });

  if (newProperties.length !== properties.length) {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: process,
      properties: { properties: newProperties }
    });
  }
}

/**
 * Normalize all payload-related itemDefinition structureRef values to java.lang.Object.
 * This prevents Kogito type mismatch errors where the event's data output has a specific
 * payload class type but the process variable has java.lang.Object or java.lang.String.
 *
 * @param element The currently selected element (used as context for commandStack)
 * @param definitions The BPMN definitions root element
 * @param commandStack The command stack for executing changes
 */
function normalizePayloadTypes(
  element: BpmnElement,
  definitions: Definitions,
  commandStack: CommandStack
): void {
  const rootElements = definitions.rootElements || [];

  for (const el of rootElements) {
    if (el.$type === 'bpmn:ItemDefinition') {
      const structureRef = (el as unknown as { structureRef?: string }).structureRef;

      // If it's a specific payload class (contains a dot but not java.lang.), normalize it
      if (structureRef &&
          structureRef.includes('.') &&
          !structureRef.startsWith('java.lang.')) {

        commandStack.execute('element.updateModdleProperties', {
          element,
          moddleElement: el,
          properties: { structureRef: 'java.lang.Object' }
        });
      }
    }
  }
}

export default class MessageEventPropertiesProvider {
  static $inject = ['propertiesPanel', 'injector', 'eventBus'];

  private injector: unknown;

  constructor(propertiesPanel: PropertiesPanel, injector: unknown, eventBus: EventBus) {
    this.injector = injector;

    // Re-render when selection changes
    eventBus.on('selection.changed', (event: SelectionChangedEvent) => {
      const selected = event.newSelection?.[0];
      if (selected && isStartMessageEvent(selected)) {
        // Selection changed to a start message event
      }
    });

    propertiesPanel.registerProvider(500, this);
  }

  getGroups(element: BpmnElement) {
    return (groups: PropertiesGroup[]) => {
      // Handle all types of message events (Start, Intermediate Catch/Throw, End, Boundary)
      // AND receive tasks (which can also consume messages like Kafka)
      if (!isMessageEvent(element) && !isReceiveTask(element)) {
        return groups;
      }

      const bpmnFactory = (this.injector as { get: (name: string) => BpmnFactory }).get('bpmnFactory');
      const commandStack = (this.injector as { get: (name: string) => CommandStack }).get('commandStack');

      // Ensure message exists with itemRef for jBPM compatibility
      // jBPM requires every Message Event to have a bpmn:Message reference with a valid itemRef
      const msgEvtDef = getMessageEventDefinition(element);
      if (msgEvtDef) {
        // This will create message if missing, or add itemRef to existing message if missing
        getOrCreateMessage(element, bpmnFactory, commandStack);
      }

      // Fix ALL messages in definitions that are missing itemRef (including orphaned messages)
      // jBPM requires all messages to have a valid itemRef
      const definitions = getDefinitions(element);
      const rootElements = definitions.rootElements || [];
      const allMessages = rootElements.filter((el: ModdleElement) => el.$type === 'bpmn:Message');

      for (const message of allMessages) {
        if (!(message as unknown as { itemRef?: ModdleElement }).itemRef) {
          const itemDefId = `_${message.id}_Item`;

          // Check if itemDefinition already exists
          let itemDef = rootElements.find((el: ModdleElement) =>
            el.$type === 'bpmn:ItemDefinition' && el.id === itemDefId
          );

          if (!itemDef) {
            // Create itemDefinition for the message
            itemDef = bpmnFactory.create('bpmn:ItemDefinition', {
              id: itemDefId,
              structureRef: 'java.lang.Object'
            });
            itemDef.$parent = definitions;

            // Add itemDefinition to rootElements BEFORE the message that references it
            // jBPM requires itemDefinition to appear before the message in the XML
            const newRootElements = [...(definitions.rootElements || [])];
            const messageIndex = newRootElements.findIndex((el: ModdleElement) => el === message);
            if (messageIndex >= 0) {
              // Insert itemDef right before the message
              newRootElements.splice(messageIndex, 0, itemDef);
            } else {
              // Fallback: insert before process
              const processIndex = newRootElements.findIndex((el: ModdleElement) => el.$type === 'bpmn:Process');
              if (processIndex >= 0) {
                newRootElements.splice(processIndex, 0, itemDef);
              } else {
                newRootElements.push(itemDef);
              }
            }

            commandStack.execute('element.updateModdleProperties', {
              element,
              moddleElement: definitions,
              properties: { rootElements: newRootElements }
            });
          }

          // Set itemRef on the message
          commandStack.execute('element.updateModdleProperties', {
            element,
            moddleElement: message,
            properties: { itemRef: itemDef }
          });
        }
      }

      // Clean up ioSpecification from events (events don't use ioSpecification - that's only for Activities/Tasks)
      // This handles both corrupted string values like "[object Object]" and actual ioSpecification objects
      const bo = element.businessObject;
      if (bo) {
        const ioSpec = bo.ioSpecification;
        if (ioSpec) {
          // Events should have dataOutputs/outputSet directly, not in ioSpecification
          // Remove the ioSpecification attribute entirely
          commandStack.execute('element.updateModdleProperties', {
            element,
            moddleElement: bo,
            properties: {
              ioSpecification: undefined
            }
          });
        }
      }

      // Fix message throw events (Intermediate Throw and End) that have data inputs missing drools:dtype
      // Kogito requires drools:dtype attribute on all data inputs for proper code generation
      // Use a WeakSet guard to prevent infinite loops from commandStack triggering re-renders
      if (isIntermediateThrowMessageEvent(element) || isEndMessageEvent(element)) {
        const throwBo = element.businessObject;
        if (throwBo) {
          // For events, dataInputs is directly on the event (not in ioSpecification)
          const dataInputs = (throwBo as unknown as { dataInputs?: ModdleElement[] }).dataInputs || [];
          for (const dataInput of dataInputs) {
            // Skip if we've already processed this dataInput
            if (fixedDtypeElements.has(dataInput)) {
              continue;
            }
            // Check if drools:dtype is missing
            const dtype = (dataInput as unknown as { 'drools:dtype'?: string })['drools:dtype'];
            if (!dtype) {
              // Mark as fixed BEFORE executing command to prevent re-entry
              fixedDtypeElements.add(dataInput);
              // Add the missing drools:dtype attribute
              commandStack.execute('element.updateModdleProperties', {
                element,
                moddleElement: dataInput,
                properties: { 'drools:dtype': 'java.lang.String' }
              });
            }
          }
        }
      }

      // Fix message receive events (Start, Intermediate Catch, and Boundary) that are missing data outputs
      // Kogito requires data output structures to know where to store received message data
      // Without this, the code generator throws a NullPointerException
      if (isStartMessageEvent(element) || isIntermediateCatchMessageEvent(element) || isBoundaryMessageEvent(element)) {
        const catchBo = element.businessObject;
        if (catchBo) {
          // Check if data outputs are missing
          const dataOutputs = (catchBo as unknown as { dataOutputs?: ModdleElement[] }).dataOutputs || [];
          if (dataOutputs.length === 0 && !fixedDtypeElements.has(catchBo)) {
            // Mark as fixed to prevent re-entry
            fixedDtypeElements.add(catchBo);

            const eventId = catchBo.id;
            if (eventId) {
              // Create itemDefinition for the data output
              const itemDefId = `_${eventId}_OutputItem`;
              let itemDef = rootElements.find((el: ModdleElement) =>
                el.$type === 'bpmn:ItemDefinition' && el.id === itemDefId
              );

              if (!itemDef) {
                itemDef = bpmnFactory.create('bpmn:ItemDefinition', {
                  id: itemDefId,
                  structureRef: 'java.lang.Object'
                });
                itemDef.$parent = definitions;

                const newRootElements = [...rootElements];
                const processIndex = newRootElements.findIndex((el: ModdleElement) => el.$type === 'bpmn:Process');
                if (processIndex >= 0) {
                  newRootElements.splice(processIndex, 0, itemDef);
                } else {
                  newRootElements.push(itemDef);
                }

                commandStack.execute('element.updateModdleProperties', {
                  element,
                  moddleElement: definitions,
                  properties: { rootElements: newRootElements }
                });
              }

              // Create data output
              const dataOutputId = `${eventId}_OutputX`;
              const dataOutput = bpmnFactory.create('bpmn:DataOutput', {
                id: dataOutputId,
                name: 'event',
                itemSubjectRef: itemDef
              });
              dataOutput.set?.('drools:dtype', 'java.lang.Object');
              dataOutput.$parent = catchBo;

              // Create output set
              const outputSet = bpmnFactory.create('bpmn:OutputSet', {
                dataOutputRefs: [dataOutput]
              });
              outputSet.$parent = catchBo;

              // Create a default process variable to store the received message data
              const process = rootElements.find((el: ModdleElement) => el.$type === 'bpmn:Process');
              const messageVarName = `message_${eventId}`;
              const messageVarId = messageVarName;

              if (process) {
                // Create itemDefinition for the process variable
                const varItemDefId = `_${messageVarId}Item`;
                const varItemDef = bpmnFactory.create('bpmn:ItemDefinition', {
                  id: varItemDefId,
                  structureRef: 'java.lang.Object'
                });
                varItemDef.$parent = definitions;

                // Add itemDefinition to rootElements
                const updatedRootElements = [...rootElements];
                const procIdx = updatedRootElements.findIndex((el: ModdleElement) => el.$type === 'bpmn:Process');
                if (procIdx >= 0) {
                  updatedRootElements.splice(procIdx, 0, varItemDef);
                } else {
                  updatedRootElements.push(varItemDef);
                }

                commandStack.execute('element.updateModdleProperties', {
                  element,
                  moddleElement: definitions,
                  properties: { rootElements: updatedRootElements }
                });

                // Create bpmn:property (process variable) for the received message
                const processProperty = bpmnFactory.create('bpmn:Property', {
                  id: messageVarId,
                  name: messageVarName,
                  itemSubjectRef: varItemDef
                });
                processProperty.$parent = process;

                // Add property to process
                const existingProperties = (process as unknown as { properties?: ModdleElement[] }).properties || [];
                commandStack.execute('element.updateModdleProperties', {
                  element,
                  moddleElement: process,
                  properties: { properties: [...existingProperties, processProperty] }
                });

                // Create data output association with targetRef pointing to the new variable
                const dataOutputAssociation = bpmnFactory.create('bpmn:DataOutputAssociation', {
                  sourceRef: [dataOutput],
                  targetRef: processProperty
                });
                dataOutputAssociation.$parent = catchBo;

                // Update the business object
                commandStack.execute('element.updateModdleProperties', {
                  element,
                  moddleElement: catchBo,
                  properties: {
                    dataOutputs: [dataOutput],
                    outputSet: outputSet,
                    dataOutputAssociations: [dataOutputAssociation]
                  }
                });
              }
            }
          }
        }
      }

      // Comprehensive cleanup of orphaned message elements and type normalization
      // Run this once per session per definitions element to avoid infinite loops
      if (!cleanedUpDefinitions.has(definitions)) {
        cleanedUpDefinitions.add(definitions);

        // Clean up orphaned itemDefinitions, messages, and process properties
        cleanupOrphanedMessageElements(element, definitions, commandStack);

        // Normalize all payload-related types to java.lang.Object to prevent type mismatch errors
        normalizePayloadTypes(element, definitions, commandStack);
      }

      // Add Payload Fields as a ListGroup for message receivers
      // (Start Message Events, Intermediate Catch Events, Boundary Events, and Receive Tasks)
      // These element types receive incoming messages and may need to extract data
      if (isMessageReceiver(element)) {
        const payloadGroup = PayloadFieldsGroup({ element, injector: this.injector });
        if (payloadGroup) {
          groups.push({
            id: 'message-payload-fields',
            component: ListGroup,
            ...payloadGroup
          });
        }
      }

      return groups;
    };
  }
}
