/**
 * Message Event Properties Provider
 * Adds properties panel configuration for Start Message Events
 *
 * Features:
 * - Message name configuration (creates/updates bpmn:message at definitions level)
 * - Payload fields definition (stored in msgevt:PayloadDefinition extension)
 * - Output mappings (creates bpmn:dataOutput and bpmn:dataOutputAssociation)
 */

// @ts-expect-error - no type definitions available
import { ListGroup, TextFieldEntry, SelectEntry } from '@bpmn-io/properties-panel';
// @ts-expect-error - no type definitions available
import { useService } from 'bpmn-js-properties-panel';

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
  label: string;
  entries: PropertyEntry[];
  component?: unknown;
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

  // Check if ioSpecification exists and is valid (not a corrupted string like "[object Object]")
  let ioSpec = bo.ioSpecification as IoSpecification;
  const isValidIoSpec = ioSpec && typeof ioSpec === 'object' && ioSpec.$type === 'bpmn:InputOutputSpecification';

  if (!isValidIoSpec) {
    // If there's a corrupted ioSpecification (string instead of object), clear it first
    if (ioSpec && typeof ioSpec === 'string') {
      // Remove the corrupted attribute by setting to undefined first
      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: bo,
        properties: { ioSpecification: undefined }
      });
    }

    // Create outputSet first
    const outputSet = bpmnFactory.create('bpmn:OutputSet', {});

    ioSpec = bpmnFactory.create('bpmn:InputOutputSpecification', {
      dataOutputs: [],
      outputSets: [outputSet]
    }) as IoSpecification;
    outputSet.$parent = ioSpec;
    ioSpec.$parent = bo;

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: bo,
      properties: { ioSpecification: ioSpec }
    });
  }

  // Check if dataOutput already exists
  const dataOutputs = ioSpec.dataOutputs || [];
  let dataOutput = dataOutputs.find((d: DataOutput) => d.name === fieldName) as DataOutput | undefined;

  if (!dataOutput) {
    dataOutput = bpmnFactory.create('bpmn:DataOutput', {
      id: outputId,
      name: fieldName,
      itemSubjectRef: itemDef
    }) as DataOutput;
    dataOutput.$parent = ioSpec;

    const newDataOutputs = [...dataOutputs, dataOutput];

    // Update ioSpecification with new dataOutput
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: ioSpec,
      properties: { dataOutputs: newDataOutputs }
    });

    // Also update outputSet dataOutputRefs through commandStack
    const outputSet = ioSpec.outputSets?.[0];
    if (outputSet) {
      const dataOutputRefs = (outputSet as unknown as { dataOutputRefs?: DataOutput[] }).dataOutputRefs || [];
      const newDataOutputRefs = [...dataOutputRefs, dataOutput];
      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: outputSet,
        properties: { dataOutputRefs: newDataOutputRefs }
      });
    }
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
    setValue,
    debounce
  });
}

/**
 * Payload Field Name component
 */
function PayloadFieldName(props: { id: string; field: PayloadField; element: BpmnElement }) {
  const { id, field, element } = props;
  const commandStack = useService('commandStack') as CommandStack;
  const translate = useService('translate') as (text: string) => string;
  const debounce = useService('debounceInput') as <T>(fn: T) => T;

  const getValue = () => field.name || '';

  const setValue = (value: string) => {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: field,
      properties: { name: value }
    });
  };

  return TextFieldEntry({
    id,
    element,
    label: translate('Field Name'),
    getValue,
    setValue,
    debounce
  });
}

/**
 * Payload Field Expression component
 * Allows specifying a JSONPath expression to extract nested data from the message payload
 */
function PayloadFieldExpression(props: { id: string; field: PayloadField; element: BpmnElement }) {
  const { id, field, element } = props;
  const commandStack = useService('commandStack') as CommandStack;
  const translate = useService('translate') as (text: string) => string;
  const debounce = useService('debounceInput') as <T>(fn: T) => T;

  const getValue = () => field.expression || '';

  const setValue = (value: string) => {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: field,
      properties: { expression: value }
    });
  };

  return TextFieldEntry({
    id,
    element,
    label: translate('Source Expression'),
    description: translate('JSONPath expression to extract value (e.g., $.request.data.id). Leave empty for top-level field.'),
    getValue,
    setValue,
    debounce
  });
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
    });
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

    // Create new field
    const newField = bpmnFactory.create('msgevt:PayloadField', {
      name: '',
      type: 'string'
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

      // Remove dataOutput from ioSpecification
      const ioSpec = bo.ioSpecification as IoSpecification;
      if (ioSpec) {
        const dataOutputs = ioSpec.dataOutputs || [];
        const newDataOutputs = dataOutputs.filter((d: DataOutput) => d.name !== field.name);

        if (newDataOutputs.length !== dataOutputs.length) {
          commandStack.execute('element.updateModdleProperties', {
            element,
            moddleElement: ioSpec,
            properties: { dataOutputs: newDataOutputs }
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

  if (!isStartMessageEvent(element)) {
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

/**
 * Create entries for Message Event Configuration
 */
function MessageEventEntries(props: { element: BpmnElement }): PropertyEntry[] {
  const { element } = props;

  // Works for all message event types
  if (!isMessageEvent(element)) {
    return [];
  }

  return [
    {
      id: 'messageName',
      component: MessageName,
      isEdited: () => {
        const msgEvtDef = getMessageEventDefinition(element);
        return !!(msgEvtDef?.messageRef?.name);
      }
    }
  ];
}

// ============================================================================
// Properties Provider Class
// ============================================================================

// Track elements that have had their drools:dtype fixed to prevent infinite loops
const fixedDtypeElements = new WeakSet<object>();

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
      if (!isMessageEvent(element)) {
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

      // Clean up corrupted ioSpecification (string "[object Object]" instead of proper element)
      const bo = element.businessObject;
      if (bo) {
        const ioSpec = bo.ioSpecification;
        if (ioSpec && typeof ioSpec === 'string') {
          // Remove the corrupted attribute and any orphaned associations
          // (associations without valid dataOutputs would cause jBPM errors)
          commandStack.execute('element.updateModdleProperties', {
            element,
            moddleElement: bo,
            properties: {
              ioSpecification: undefined,
              dataOutputAssociations: undefined
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

      // Fix message catch events (Intermediate Catch and Boundary) that are missing data outputs
      // Kogito requires data output structures to know where to store received message data
      // Without this, the code generator throws a NullPointerException
      if (isIntermediateCatchMessageEvent(element) || isBoundaryMessageEvent(element)) {
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
                  structureRef: 'java.lang.String'
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
              dataOutput.set?.('drools:dtype', 'java.lang.String');
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
                  structureRef: 'java.lang.String'
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

      // Clean up orphaned messages that are not referenced by any message event
      // Orphaned messages can cause Kogito code generation errors (duplicate topic names, missing producers)
      // Use a guard to only run this cleanup once per session
      if (!fixedDtypeElements.has(definitions)) {
        fixedDtypeElements.add(definitions);

        // Find all messages in definitions
        const allMessagesInDefs = rootElements.filter((el: ModdleElement) => el.$type === 'bpmn:Message');

        // Find all message references from message events in the process
        const process = rootElements.find((el: ModdleElement) => el.$type === 'bpmn:Process');
        const referencedMessageIds = new Set<string>();

        if (process) {
          const flowElements = (process as unknown as { flowElements?: ModdleElement[] }).flowElements || [];
          for (const flowElement of flowElements) {
            const eventDefs = (flowElement as unknown as { eventDefinitions?: ModdleElement[] }).eventDefinitions || [];
            for (const ed of eventDefs) {
              if (ed.$type === 'bpmn:MessageEventDefinition') {
                const msgRef = (ed as unknown as { messageRef?: ModdleElement }).messageRef;
                if (msgRef?.id) {
                  referencedMessageIds.add(msgRef.id);
                }
              }
            }
          }
        }

        // Find orphaned messages (messages not referenced by any event)
        const orphanedMessages = allMessagesInDefs.filter((msg: ModdleElement) =>
          msg.id && !referencedMessageIds.has(msg.id)
        );

        if (orphanedMessages.length > 0) {
          // Collect all elements to remove (orphaned messages and their itemDefinitions)
          const elementsToRemove = new Set<string>();

          for (const orphanedMsg of orphanedMessages) {
            if (orphanedMsg.id) {
              elementsToRemove.add(orphanedMsg.id);

              // Also remove the message's itemRef (itemDefinition)
              const itemRef = (orphanedMsg as unknown as { itemRef?: ModdleElement }).itemRef;
              if (itemRef?.id) {
                elementsToRemove.add(itemRef.id);
              }

              // Also check for event-specific itemDefinitions (pattern: _Event_xxx_InputItem)
              // These are created for message throw events
              const msgIdMatch = orphanedMsg.id.match(/Message_Event_(.+)/);
              if (msgIdMatch) {
                const eventId = `Event_${msgIdMatch[1]}`;
                const eventItemDefId = `_${eventId}_InputItem`;
                if (rootElements.some((el: ModdleElement) => el.id === eventItemDefId)) {
                  elementsToRemove.add(eventItemDefId);
                }
              }
            }
          }

          // Remove orphaned elements
          const newRootElements = rootElements.filter((el: ModdleElement) =>
            !elementsToRemove.has(el.id || '')
          );

          if (newRootElements.length < rootElements.length) {
            commandStack.execute('element.updateModdleProperties', {
              element,
              moddleElement: definitions,
              properties: { rootElements: newRootElements }
            });
          }
        }
      }

      // Add Message Event Configuration group for all message event types
      groups.push({
        id: 'message-event-configuration',
        label: 'Message Event Configuration',
        entries: MessageEventEntries({ element })
      });

      // Add Payload Fields as a ListGroup (only for Start Message Events and Intermediate Catch Events)
      // These event types receive incoming messages and may need to extract data
      if (isStartMessageEvent(element) || isIntermediateCatchMessageEvent(element) || isBoundaryMessageEvent(element)) {
        const payloadGroup = PayloadFieldsGroup({ element, injector: this.injector });
        if (payloadGroup) {
          groups.push({
            id: 'message-payload-fields',
            component: ListGroup,
            ...payloadGroup
          } as PropertiesGroup);
        }
      }

      return groups;
    };
  }
}
