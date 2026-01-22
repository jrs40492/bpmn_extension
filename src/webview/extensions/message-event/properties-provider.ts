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
 * Get the message event definition from a start message event
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
    return msgEvtDef.messageRef;
  }

  // Create new message at definitions level
  const definitions = getDefinitions(element);
  const bo = element.businessObject;
  const messageId = `Message_${bo?.id || 'unknown'}`;

  const message = bpmnFactory.create('bpmn:Message', {
    id: messageId,
    name: ''
  }) as Message;
  message.$parent = definitions;

  // Add message to definitions rootElements
  const newRootElements = [...(definitions.rootElements || [])];
  // Insert before the first process element
  const processIndex = newRootElements.findIndex((el: ModdleElement) => el.$type === 'bpmn:Process');
  if (processIndex >= 0) {
    newRootElements.splice(processIndex, 0, message);
  } else {
    newRootElements.push(message);
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

  if (!isStartMessageEvent(element)) {
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
      if (!isStartMessageEvent(element)) {
        return groups;
      }

      const bpmnFactory = (this.injector as { get: (name: string) => BpmnFactory }).get('bpmnFactory');
      const commandStack = (this.injector as { get: (name: string) => CommandStack }).get('commandStack');

      // Ensure message exists for jBPM compatibility
      // jBPM requires every Start Message Event to have a bpmn:Message reference
      const msgEvtDef = getMessageEventDefinition(element);
      if (msgEvtDef && !msgEvtDef.messageRef) {
        getOrCreateMessage(element, bpmnFactory, commandStack);
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

      // Add Message Event Configuration group
      groups.push({
        id: 'message-event-configuration',
        label: 'Message Event Configuration',
        entries: MessageEventEntries({ element })
      });

      // Add Payload Fields as a ListGroup
      const payloadGroup = PayloadFieldsGroup({ element, injector: this.injector });
      if (payloadGroup) {
        groups.push({
          id: 'message-payload-fields',
          component: ListGroup,
          ...payloadGroup
        } as PropertiesGroup);
      }

      return groups;
    };
  }
}
