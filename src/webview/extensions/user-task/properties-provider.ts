/**
 * User Task Properties Provider
 * Adds task configuration and data I/O mappings to the properties panel for User Tasks.
 *
 * User task config (TaskName, ActorId, GroupId, etc.) is stored as assignment-based
 * dataInputAssociation entries inside ioSpecification (jBPM/Kogito convention).
 * Data I/O mappings use sourceRef/targetRef patterns to bind process variables.
 */

// @ts-expect-error - no type definitions available
import { TextFieldEntry, CheckboxEntry, SelectEntry, ListGroup } from '@bpmn-io/properties-panel';
// @ts-expect-error - no type definitions available
import { useService } from 'bpmn-js-properties-panel';
import { html } from 'htm/preact';

// Standard jBPM config field names stored via assignment-based dataInputAssociation
const JBPM_CONFIG_FIELDS = ['TaskName', 'ActorId', 'GroupId', 'CreatedBy', 'Skippable', 'Priority', 'Comment', 'Description', 'Content', 'NotStartedReassign', 'NotCompletedReassign', 'NotStartedNotify', 'NotCompletedNotify'];

// ============================================================================
// Type Definitions
// ============================================================================

interface ModdleElement {
  $type: string;
  $parent?: ModdleElement;
  id?: string;
  name?: string;
  [key: string]: unknown;
}

interface BpmnElement {
  businessObject?: ModdleElement;
}

interface PropertiesPanel {
  registerProvider(priority: number, provider: unknown): void;
}

interface PropertiesGroup {
  id: string;
  label: string;
  entries?: unknown[];
  component?: unknown;
  items?: unknown[];
  add?: (event: Event) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

function isUserTask(element: BpmnElement): boolean {
  return element?.businessObject?.$type === 'bpmn:UserTask';
}

function getBusinessObject(element: BpmnElement): ModdleElement | undefined {
  return element?.businessObject;
}

/**
 * Read a config field value from assignment-based dataInputAssociation.
 * Finds the association whose targetRef points to a dataInput with the given name,
 * then reads assignment.from.body.
 */
function getConfigValue(bo: ModdleElement, fieldName: string): string {
  const associations = (bo.dataInputAssociations || []) as ModdleElement[];
  for (const assoc of associations) {
    const targetRef = assoc.targetRef as ModdleElement | undefined;
    if (!targetRef || targetRef.name !== fieldName) continue;

    const assignments = (assoc.assignment || []) as ModdleElement[];
    if (assignments.length > 0) {
      const from = assignments[0].from as ModdleElement | undefined;
      if (from && from.body !== undefined) {
        return String(from.body);
      }
    }
  }
  return '';
}

/**
 * Write a config field value via assignment-based dataInputAssociation.
 * Updates existing or creates new dataInput + dataInputAssociation + assignment.
 */
function setConfigValue(
  element: BpmnElement,
  bo: ModdleElement,
  fieldName: string,
  value: string,
  commandStack: { execute: (cmd: string, ctx: Record<string, unknown>) => void },
  bpmnFactory: { create: (type: string, attrs?: Record<string, unknown>) => ModdleElement }
): void {
  const associations = (bo.dataInputAssociations || []) as ModdleElement[];

  // Try to update existing
  for (const assoc of associations) {
    const targetRef = assoc.targetRef as ModdleElement | undefined;
    if (!targetRef || targetRef.name !== fieldName) continue;

    const assignments = (assoc.assignment || []) as ModdleElement[];
    if (assignments.length > 0) {
      const from = assignments[0].from as ModdleElement | undefined;
      if (from) {
        from.body = value;
        // Trigger change
        commandStack.execute('element.updateModdleProperties', {
          element,
          moddleElement: bo,
          properties: { name: bo.name || '' }
        });
        return;
      }
    }
  }

  // Create new dataInput + association + assignment
  const taskId = bo.id || 'UserTask';
  const inputId = `${taskId}_${fieldName}Input`;

  const dataInput = bpmnFactory.create('bpmn:DataInput', {
    id: inputId,
    name: fieldName
  });
  (dataInput as any).set('drools:dtype', 'java.lang.String');

  // Ensure ioSpecification exists
  let ioSpec = bo.ioSpecification as ModdleElement | undefined;
  if (!ioSpec) {
    const inputSet = bpmnFactory.create('bpmn:InputSet', { dataInputRefs: [] });
    const outputSet = bpmnFactory.create('bpmn:OutputSet', { dataOutputRefs: [] });
    ioSpec = bpmnFactory.create('bpmn:InputOutputSpecification', {
      dataInputs: [],
      dataOutputs: [],
      inputSets: [inputSet],
      outputSets: [outputSet]
    });
    inputSet.$parent = ioSpec;
    outputSet.$parent = ioSpec;
    ioSpec.$parent = bo;
    bo.ioSpecification = ioSpec;
  }

  // Add dataInput to ioSpecification
  dataInput.$parent = ioSpec;
  const dataInputs = (ioSpec.dataInputs || []) as ModdleElement[];
  dataInputs.push(dataInput);
  ioSpec.dataInputs = dataInputs;

  // Add to inputSet
  const inputSets = (ioSpec.inputSets || []) as ModdleElement[];
  if (inputSets.length > 0) {
    const refs = (inputSets[0].dataInputRefs || []) as ModdleElement[];
    refs.push(dataInput);
    inputSets[0].dataInputRefs = refs;
  }

  // Create assignment
  const fromExpr = bpmnFactory.create('bpmn:FormalExpression', { body: value });
  const toExpr = bpmnFactory.create('bpmn:FormalExpression', { body: inputId });
  const assignment = bpmnFactory.create('bpmn:Assignment', {
    from: fromExpr,
    to: toExpr
  });
  fromExpr.$parent = assignment;
  toExpr.$parent = assignment;

  // Create dataInputAssociation
  const assoc = bpmnFactory.create('bpmn:DataInputAssociation', {
    targetRef: dataInput,
    assignment: [assignment]
  });
  assignment.$parent = assoc;
  assoc.$parent = bo;

  if (!bo.dataInputAssociations) {
    bo.dataInputAssociations = [];
  }
  (bo.dataInputAssociations as ModdleElement[]).push(assoc);

  // Trigger change
  commandStack.execute('element.updateModdleProperties', {
    element,
    moddleElement: bo,
    properties: { name: bo.name || '' }
  });
}

/**
 * Check if a dataInputAssociation is assignment-based (config field)
 * vs sourceRef/targetRef based (process variable mapping)
 */
function isAssignmentBased(assoc: ModdleElement): boolean {
  const assignments = (assoc.assignment || []) as ModdleElement[];
  return assignments.length > 0;
}

/**
 * Check if a dataInput name is a standard jBPM config field
 */
function isConfigField(name: string): boolean {
  return JBPM_CONFIG_FIELDS.includes(name);
}

// ============================================================================
// Task Configuration Property Components
// ============================================================================

function TaskNameField(props: { element: BpmnElement; id: string }) {
  const { element, id } = props;
  const commandStack = useService('commandStack');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const bpmnFactory = useService('bpmnFactory');
  const bo = getBusinessObject(element)!;

  return TextFieldEntry({
    id,
    element,
    label: translate('Task Name'),
    description: translate('WID task name identifier'),
    getValue: () => getConfigValue(bo, 'TaskName'),
    setValue: (value: string) => setConfigValue(element, bo, 'TaskName', value, commandStack, bpmnFactory),
    debounce
  });
}

function ActorsField(props: { element: BpmnElement; id: string }) {
  const { element, id } = props;
  const commandStack = useService('commandStack');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const bpmnFactory = useService('bpmnFactory');
  const bo = getBusinessObject(element)!;

  return TextFieldEntry({
    id,
    element,
    label: translate('Actors'),
    description: translate('Comma-separated user IDs'),
    getValue: () => getConfigValue(bo, 'ActorId'),
    setValue: (value: string) => setConfigValue(element, bo, 'ActorId', value, commandStack, bpmnFactory),
    debounce
  });
}

function GroupsField(props: { element: BpmnElement; id: string }) {
  const { element, id } = props;
  const commandStack = useService('commandStack');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const bpmnFactory = useService('bpmnFactory');
  const bo = getBusinessObject(element)!;

  return TextFieldEntry({
    id,
    element,
    label: translate('Groups'),
    description: translate('Comma-separated group names'),
    getValue: () => getConfigValue(bo, 'GroupId'),
    setValue: (value: string) => setConfigValue(element, bo, 'GroupId', value, commandStack, bpmnFactory),
    debounce
  });
}

function CreatedByField(props: { element: BpmnElement; id: string }) {
  const { element, id } = props;
  const commandStack = useService('commandStack');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const bpmnFactory = useService('bpmnFactory');
  const bo = getBusinessObject(element)!;

  return TextFieldEntry({
    id,
    element,
    label: translate('Created By'),
    getValue: () => getConfigValue(bo, 'CreatedBy'),
    setValue: (value: string) => setConfigValue(element, bo, 'CreatedBy', value, commandStack, bpmnFactory),
    debounce
  });
}

function SkippableField(props: { element: BpmnElement; id: string }) {
  const { element, id } = props;
  const commandStack = useService('commandStack');
  const translate = useService('translate');
  const bpmnFactory = useService('bpmnFactory');
  const bo = getBusinessObject(element)!;

  return CheckboxEntry({
    id,
    element,
    label: translate('Skippable'),
    getValue: () => getConfigValue(bo, 'Skippable') === 'true',
    setValue: (value: boolean) => setConfigValue(element, bo, 'Skippable', value ? 'true' : 'false', commandStack, bpmnFactory)
  });
}

function PriorityField(props: { element: BpmnElement; id: string }) {
  const { element, id } = props;
  const commandStack = useService('commandStack');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const bpmnFactory = useService('bpmnFactory');
  const bo = getBusinessObject(element)!;

  return TextFieldEntry({
    id,
    element,
    label: translate('Priority'),
    description: translate('Numeric priority value'),
    getValue: () => getConfigValue(bo, 'Priority'),
    setValue: (value: string) => setConfigValue(element, bo, 'Priority', value, commandStack, bpmnFactory),
    debounce
  });
}

// ============================================================================
// Data I/O Mapping Components
// ============================================================================

/**
 * Get input mappings (sourceRef/targetRef based, excluding config fields)
 */
function getInputMappings(bo: ModdleElement): Array<{ assoc: ModdleElement; inputName: string; processVar: string }> {
  const result: Array<{ assoc: ModdleElement; inputName: string; processVar: string }> = [];
  const associations = (bo.dataInputAssociations || []) as ModdleElement[];

  for (const assoc of associations) {
    if (isAssignmentBased(assoc)) continue;

    const targetRef = assoc.targetRef as ModdleElement | undefined;
    const inputName = targetRef?.name || '';
    if (isConfigField(inputName)) continue;

    const sourceRefs = (assoc.sourceRef || []) as (ModdleElement | string)[];
    let processVar = '';
    if (sourceRefs.length > 0) {
      const ref = sourceRefs[0];
      processVar = typeof ref === 'string' ? ref : (ref.name || ref.id || '');
    }

    result.push({ assoc, inputName, processVar });
  }
  return result;
}

/**
 * Get output mappings (sourceRef/targetRef based)
 */
function getOutputMappings(bo: ModdleElement): Array<{ assoc: ModdleElement; outputName: string; processVar: string }> {
  const result: Array<{ assoc: ModdleElement; outputName: string; processVar: string }> = [];
  const associations = (bo.dataOutputAssociations || []) as ModdleElement[];

  for (const assoc of associations) {
    const sourceRefs = (assoc.sourceRef || []) as (ModdleElement | string)[];
    let outputName = '';
    if (sourceRefs.length > 0) {
      const ref = sourceRefs[0];
      outputName = typeof ref === 'string' ? ref : (ref.name || ref.id || '');
    }

    const targetRef = assoc.targetRef;
    let processVar = '';
    if (typeof targetRef === 'string') {
      processVar = targetRef;
    } else if (targetRef) {
      processVar = (targetRef as ModdleElement).name || (targetRef as ModdleElement).id || '';
    }

    result.push({ assoc, outputName, processVar });
  }
  return result;
}

// Input mapping entry fields
function InputMappingName(props: { id: string; mapping: { assoc: ModdleElement; inputName: string }; element: BpmnElement }) {
  const { id, mapping, element } = props;
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const commandStack = useService('commandStack');
  const bo = getBusinessObject(element)!;

  return TextFieldEntry({
    id,
    element,
    label: translate('Task Input'),
    getValue: () => mapping.inputName,
    setValue: (value: string) => {
      const targetRef = mapping.assoc.targetRef as ModdleElement | undefined;
      if (targetRef) {
        targetRef.name = value;
        commandStack.execute('element.updateModdleProperties', {
          element,
          moddleElement: bo,
          properties: { name: bo.name || '' }
        });
      }
    },
    debounce
  });
}

function InputMappingVar(props: { id: string; mapping: { assoc: ModdleElement; processVar: string }; element: BpmnElement }) {
  const { id, mapping, element } = props;
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const commandStack = useService('commandStack');
  const bo = getBusinessObject(element)!;

  return TextFieldEntry({
    id,
    element,
    label: translate('Process Variable'),
    getValue: () => mapping.processVar,
    setValue: (value: string) => {
      const sourceRefs = (mapping.assoc.sourceRef || []) as (ModdleElement | string)[];
      if (sourceRefs.length > 0) {
        const ref = sourceRefs[0];
        if (typeof ref === 'string') {
          (mapping.assoc.sourceRef as string[])[0] = value;
        } else {
          ref.name = value;
          ref.id = value;
        }
      }
      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: bo,
        properties: { name: bo.name || '' }
      });
    },
    debounce
  });
}

// Output mapping entry fields
function OutputMappingName(props: { id: string; mapping: { assoc: ModdleElement; outputName: string }; element: BpmnElement }) {
  const { id, mapping, element } = props;
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const commandStack = useService('commandStack');
  const bo = getBusinessObject(element)!;

  return TextFieldEntry({
    id,
    element,
    label: translate('Task Output'),
    getValue: () => mapping.outputName,
    setValue: (value: string) => {
      const sourceRefs = (mapping.assoc.sourceRef || []) as (ModdleElement | string)[];
      if (sourceRefs.length > 0) {
        const ref = sourceRefs[0];
        if (typeof ref === 'string') {
          (mapping.assoc.sourceRef as string[])[0] = value;
        } else {
          ref.name = value;
        }
      }
      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: bo,
        properties: { name: bo.name || '' }
      });
    },
    debounce
  });
}

function OutputMappingVar(props: { id: string; mapping: { assoc: ModdleElement; processVar: string }; element: BpmnElement }) {
  const { id, mapping, element } = props;
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const commandStack = useService('commandStack');
  const bo = getBusinessObject(element)!;

  return TextFieldEntry({
    id,
    element,
    label: translate('Process Variable'),
    getValue: () => mapping.processVar,
    setValue: (value: string) => {
      const targetRef = mapping.assoc.targetRef;
      if (typeof targetRef === 'string') {
        mapping.assoc.targetRef = value;
      } else if (targetRef) {
        (targetRef as ModdleElement).name = value;
        (targetRef as ModdleElement).id = value;
      }
      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: bo,
        properties: { name: bo.name || '' }
      });
    },
    debounce
  });
}

// ============================================================================
// Data I/O List Group
// ============================================================================

function DataIOMappingsGroup(props: { element: BpmnElement; injector: { get: (name: string) => unknown } }) {
  const { element, injector } = props;

  if (!isUserTask(element)) return null;

  const bo = getBusinessObject(element)!;
  const bpmnFactory = injector.get('bpmnFactory') as { create: (type: string, attrs?: Record<string, unknown>) => ModdleElement };
  const commandStack = injector.get('commandStack') as { execute: (cmd: string, ctx: Record<string, unknown>) => void };
  const translate = injector.get('translate') as (text: string) => string;

  const inputMappings = getInputMappings(bo);
  const outputMappings = getOutputMappings(bo);

  const items: unknown[] = [];

  // Input mappings
  for (let i = 0; i < inputMappings.length; i++) {
    const mapping = inputMappings[i];
    const id = `${(element as { id?: string }).id || 'el'}-input-${i}`;
    items.push({
      id,
      label: `${mapping.processVar} \u2192 ${mapping.inputName}`,
      entries: [
        {
          id: `${id}-name`,
          component: InputMappingName,
          mapping,
          element
        },
        {
          id: `${id}-var`,
          component: InputMappingVar,
          mapping,
          element
        }
      ],
      remove: createRemoveInputHandler(commandStack, element, bo, mapping.assoc)
    });
  }

  // Output mappings
  for (let i = 0; i < outputMappings.length; i++) {
    const mapping = outputMappings[i];
    const id = `${(element as { id?: string }).id || 'el'}-output-${i}`;
    items.push({
      id,
      label: `${mapping.outputName} \u2192 ${mapping.processVar}`,
      entries: [
        {
          id: `${id}-name`,
          component: OutputMappingName,
          mapping,
          element
        },
        {
          id: `${id}-var`,
          component: OutputMappingVar,
          mapping,
          element
        }
      ],
      remove: createRemoveOutputHandler(commandStack, element, bo, mapping.assoc)
    });
  }

  return {
    items,
    add: createAddInputMappingHandler(bpmnFactory, commandStack, element, bo),
    label: translate('Data I/O Mappings')
  };
}

function createRemoveInputHandler(
  commandStack: { execute: (cmd: string, ctx: Record<string, unknown>) => void },
  element: BpmnElement,
  bo: ModdleElement,
  assoc: ModdleElement
) {
  return function(event: Event) {
    event.stopPropagation();
    const associations = (bo.dataInputAssociations || []) as ModdleElement[];
    bo.dataInputAssociations = associations.filter(a => a !== assoc);

    // Also remove the dataInput from ioSpecification
    const targetRef = assoc.targetRef as ModdleElement | undefined;
    if (targetRef) {
      const ioSpec = bo.ioSpecification as ModdleElement | undefined;
      if (ioSpec) {
        const dataInputs = (ioSpec.dataInputs || []) as ModdleElement[];
        ioSpec.dataInputs = dataInputs.filter(d => d !== targetRef);
        // Remove from inputSet
        const inputSets = (ioSpec.inputSets || []) as ModdleElement[];
        if (inputSets.length > 0) {
          const refs = (inputSets[0].dataInputRefs || []) as ModdleElement[];
          inputSets[0].dataInputRefs = refs.filter(r => r !== targetRef);
        }
      }
    }

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: bo,
      properties: { name: bo.name || '' }
    });
  };
}

function createRemoveOutputHandler(
  commandStack: { execute: (cmd: string, ctx: Record<string, unknown>) => void },
  element: BpmnElement,
  bo: ModdleElement,
  assoc: ModdleElement
) {
  return function(event: Event) {
    event.stopPropagation();
    const associations = (bo.dataOutputAssociations || []) as ModdleElement[];
    bo.dataOutputAssociations = associations.filter(a => a !== assoc);

    // Also remove the dataOutput from ioSpecification
    const sourceRefs = (assoc.sourceRef || []) as (ModdleElement | string)[];
    if (sourceRefs.length > 0 && typeof sourceRefs[0] !== 'string') {
      const outputRef = sourceRefs[0] as ModdleElement;
      const ioSpec = bo.ioSpecification as ModdleElement | undefined;
      if (ioSpec) {
        const dataOutputs = (ioSpec.dataOutputs || []) as ModdleElement[];
        ioSpec.dataOutputs = dataOutputs.filter(d => d !== outputRef);
        // Remove from outputSet
        const outputSets = (ioSpec.outputSets || []) as ModdleElement[];
        if (outputSets.length > 0) {
          const refs = (outputSets[0].dataOutputRefs || []) as ModdleElement[];
          outputSets[0].dataOutputRefs = refs.filter(r => r !== outputRef);
        }
      }
    }

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: bo,
      properties: { name: bo.name || '' }
    });
  };
}

function createAddInputMappingHandler(
  bpmnFactory: { create: (type: string, attrs?: Record<string, unknown>) => ModdleElement },
  commandStack: { execute: (cmd: string, ctx: Record<string, unknown>) => void },
  element: BpmnElement,
  bo: ModdleElement
) {
  return function(event: Event) {
    event.stopPropagation();

    const taskId = bo.id || 'UserTask';
    const inputId = `${taskId}_newInput_${Date.now()}`;

    // Create dataInput
    const dataInput = bpmnFactory.create('bpmn:DataInput', {
      id: inputId,
      name: ''
    });
    (dataInput as any).set('drools:dtype', 'java.io.Serializable');

    // Ensure ioSpecification
    let ioSpec = bo.ioSpecification as ModdleElement | undefined;
    if (!ioSpec) {
      const inputSet = bpmnFactory.create('bpmn:InputSet', { dataInputRefs: [] });
      const outputSet = bpmnFactory.create('bpmn:OutputSet', { dataOutputRefs: [] });
      ioSpec = bpmnFactory.create('bpmn:InputOutputSpecification', {
        dataInputs: [],
        dataOutputs: [],
        inputSets: [inputSet],
        outputSets: [outputSet]
      });
      inputSet.$parent = ioSpec;
      outputSet.$parent = ioSpec;
      ioSpec.$parent = bo;
      bo.ioSpecification = ioSpec;
    }

    dataInput.$parent = ioSpec;
    const dataInputs = (ioSpec.dataInputs || []) as ModdleElement[];
    dataInputs.push(dataInput);
    ioSpec.dataInputs = dataInputs;

    const inputSets = (ioSpec.inputSets || []) as ModdleElement[];
    if (inputSets.length > 0) {
      const refs = (inputSets[0].dataInputRefs || []) as ModdleElement[];
      refs.push(dataInput);
      inputSets[0].dataInputRefs = refs;
    }

    // Create sourceRef/targetRef based association (not assignment-based)
    const assoc = bpmnFactory.create('bpmn:DataInputAssociation', {
      sourceRef: [],
      targetRef: dataInput
    });
    assoc.$parent = bo;

    if (!bo.dataInputAssociations) {
      bo.dataInputAssociations = [];
    }
    (bo.dataInputAssociations as ModdleElement[]).push(assoc);

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: bo,
      properties: { name: bo.name || '' }
    });
  };
}

// ============================================================================
// Form Fields (utform:FormDefinition) Components
// ============================================================================

/**
 * Get the utform:FormDefinition from extensionElements
 */
function getFormDefinition(element: BpmnElement): ModdleElement | undefined {
  const bo = getBusinessObject(element);
  if (!bo) return undefined;
  const extElements = bo.extensionElements as ModdleElement | undefined;
  if (!extElements) return undefined;
  const values = ((extElements as any).values || []) as ModdleElement[];
  return values.find(v => v.$type === 'utform:FormDefinition');
}

/**
 * Ensure extensionElements and FormDefinition exist on the element
 */
function ensureFormDefinition(
  element: BpmnElement,
  bpmnFactory: { create: (type: string, attrs?: Record<string, unknown>) => ModdleElement },
  commandStack: { execute: (cmd: string, ctx: Record<string, unknown>) => void }
): ModdleElement {
  const bo = getBusinessObject(element)!;

  // Ensure extensionElements exists
  let extensionElements = bo.extensionElements as ModdleElement | undefined;
  if (!extensionElements) {
    extensionElements = bpmnFactory.create('bpmn:ExtensionElements', { values: [] });
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: bo,
      properties: { extensionElements }
    });
  }

  // Check if FormDefinition already exists
  let formDef = getFormDefinition(element);
  if (!formDef) {
    formDef = bpmnFactory.create('utform:FormDefinition', { fields: [] });
    formDef.$parent = extensionElements;

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: extensionElements,
      properties: {
        values: [...((extensionElements.values || []) as ModdleElement[]), formDef]
      }
    });
  }

  return formDef;
}

/**
 * Get form fields from the FormDefinition
 */
function getFormFields(element: BpmnElement): ModdleElement[] {
  const formDef = getFormDefinition(element);
  if (!formDef) return [];
  return (formDef.fields || []) as ModdleElement[];
}

/**
 * Map drools:dtype to form field type
 */
function dtypeToFormType(dtype: string): string {
  const normalized = dtype.replace(/^java\.lang\./, '').toLowerCase();
  switch (normalized) {
    case 'string':
      return 'string';
    case 'boolean':
      return 'boolean';
    case 'integer':
    case 'int':
    case 'long':
      return 'integer';
    case 'double':
    case 'float':
    case 'number':
      return 'number';
    default:
      return 'object';
  }
}

/**
 * Map form field type to drools:dtype for form generation
 */
function formTypeToDtype(type: string): string {
  switch (type) {
    case 'string':
      return 'java.lang.String';
    case 'boolean':
      return 'java.lang.Boolean';
    case 'integer':
      return 'java.lang.Integer';
    case 'number':
      return 'java.lang.Double';
    case 'object':
      return 'java.io.Serializable';
    default:
      return 'java.io.Serializable';
  }
}

// Form field type options for SelectEntry
const FORM_FIELD_TYPES = [
  { value: 'string', label: 'String' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'integer', label: 'Integer' },
  { value: 'number', label: 'Number' },
  { value: 'object', label: 'Object' }
];

// Form field section options for SelectEntry
const FORM_FIELD_SECTIONS = [
  { value: 'input', label: 'Input (read-only)' },
  { value: 'output', label: 'Output (editable)' }
];

/**
 * Form Field Name entry
 */
function FormFieldNameEntry(props: { id: string; field: ModdleElement; element: BpmnElement }) {
  const { id, field, element } = props;
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const commandStack = useService('commandStack');

  return TextFieldEntry({
    id,
    element,
    label: translate('Name'),
    description: translate('Supports dot-notation (e.g. pull_request.author)'),
    getValue: () => field.name || '',
    setValue: (value: string) => {
      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: field,
        properties: { name: value }
      });
    },
    debounce
  });
}

/**
 * Form Field Type entry
 */
function FormFieldTypeEntry(props: { id: string; field: ModdleElement; element: BpmnElement }) {
  const { id, field, element } = props;
  const translate = useService('translate');
  const commandStack = useService('commandStack');

  return SelectEntry({
    id,
    element,
    label: translate('Type'),
    getValue: () => String(field.type || 'string'),
    setValue: (value: string) => {
      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: field,
        properties: { type: value }
      });
    },
    getOptions: () => FORM_FIELD_TYPES.map(t => ({ value: t.value, label: translate(t.label) }))
  });
}

/**
 * Form Field Section entry
 */
function FormFieldSectionEntry(props: { id: string; field: ModdleElement; element: BpmnElement }) {
  const { id, field, element } = props;
  const translate = useService('translate');
  const commandStack = useService('commandStack');

  return SelectEntry({
    id,
    element,
    label: translate('Section'),
    getValue: () => String(field.section || 'input'),
    setValue: (value: string) => {
      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: field,
        properties: { section: value }
      });
    },
    getOptions: () => FORM_FIELD_SECTIONS.map(s => ({ value: s.value, label: translate(s.label) }))
  });
}

/**
 * Form Field Default Value entry
 */
function FormFieldDefaultValueEntry(props: { id: string; field: ModdleElement; element: BpmnElement }) {
  const { id, field, element } = props;
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const commandStack = useService('commandStack');
  const fieldType = (field.type as string) || 'string';

  if (fieldType === 'boolean') {
    return CheckboxEntry({
      id,
      element,
      label: translate('Default Value'),
      getValue: () => (field.defaultValue as string) === 'true',
      setValue: (value: boolean) => {
        commandStack.execute('element.updateModdleProperties', {
          element,
          moddleElement: field,
          properties: { defaultValue: value ? 'true' : 'false' }
        });
      }
    });
  }

  return TextFieldEntry({
    id,
    element,
    label: translate('Default Value'),
    description: translate('Hardcoded default when no data is available'),
    getValue: () => (field.defaultValue as string) || '',
    setValue: (value: string) => {
      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: field,
        properties: { defaultValue: value || undefined }
      });
    },
    debounce
  });
}

/**
 * Walk up from an element's business object to find the parent bpmn:Process.
 */
function findParentProcess(element: BpmnElement): ModdleElement | undefined {
  const bo = getBusinessObject(element);
  if (!bo) return undefined;

  let parent = bo.$parent;
  while (parent && parent.$type !== 'bpmn:Process') {
    parent = parent.$parent;
  }
  return parent;
}

/**
 * Get process variables from the parent bpmn:Process element.
 * Reads bpmn:Property children from the process.
 */
function getProcessVariableNames(element: BpmnElement): string[] {
  const parent = findParentProcess(element);
  if (!parent) return [];

  const properties = (parent.properties || []) as ModdleElement[];
  return properties
    .map(p => (p.name as string) || '')
    .filter(name => !!name);
}

/**
 * Get a map of process variable name → defaultValue from bamoe:ProcessVariables.
 * Used to resolve default values when a form field binds to a process variable.
 */
function getProcessVariableDefaults(element: BpmnElement): Map<string, string> {
  const result = new Map<string, string>();
  const process = findParentProcess(element);
  if (!process) return result;

  const extElements = process.extensionElements as ModdleElement | undefined;
  if (!extElements) return result;

  const values = ((extElements as any).values || []) as ModdleElement[];
  const processVars = values.find(v => v.$type === 'bamoe:ProcessVariables');
  if (!processVars) return result;

  const variables = (processVars.variables || []) as ModdleElement[];
  for (const v of variables) {
    const name = v.name as string | undefined;
    const defaultValue = v.defaultValue as string | undefined;
    if (name && defaultValue) {
      result.set(name, defaultValue);
    }
  }
  return result;
}

/**
 * Form Field Process Variable entry
 */
function FormFieldVariableEntry(props: { id: string; field: ModdleElement; element: BpmnElement }) {
  const { id, field, element } = props;
  const translate = useService('translate');
  const commandStack = useService('commandStack');

  return SelectEntry({
    id,
    element,
    label: translate('Process Variable'),
    description: translate('Bind to a process variable for data reading'),
    getValue: () => (field.variable as string) || '',
    setValue: (value: string) => {
      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: field,
        properties: { variable: value || undefined }
      });
    },
    getOptions: () => {
      const varNames = getProcessVariableNames(element);
      const options = [{ value: '', label: translate('(none)') }];
      for (const name of varNames) {
        options.push({ value: name, label: name });
      }
      return options;
    }
  });
}

/**
 * Form Field entry component - renders fields for a single form field
 */
function FormFieldEntry(props: { idPrefix: string; field: ModdleElement; element: BpmnElement }) {
  const { idPrefix, field, element } = props;

  return [
    {
      id: `${idPrefix}-name`,
      component: FormFieldNameEntry,
      field,
      element
    },
    {
      id: `${idPrefix}-type`,
      component: FormFieldTypeEntry,
      field,
      element
    },
    {
      id: `${idPrefix}-section`,
      component: FormFieldSectionEntry,
      field,
      element
    },
    {
      id: `${idPrefix}-variable`,
      component: FormFieldVariableEntry,
      field,
      element
    },
    {
      id: `${idPrefix}-defaultValue`,
      component: FormFieldDefaultValueEntry,
      field,
      element
    }
  ];
}

/**
 * Create handler to add a new form field
 */
function createAddFormFieldHandler(
  bpmnFactory: { create: (type: string, attrs?: Record<string, unknown>) => ModdleElement },
  commandStack: { execute: (cmd: string, ctx: Record<string, unknown>) => void },
  element: BpmnElement
) {
  return function(event: Event) {
    event.stopPropagation();

    const formDef = ensureFormDefinition(element, bpmnFactory, commandStack);

    const newField = bpmnFactory.create('utform:FormField', {
      name: '',
      type: 'string',
      section: 'input'
    });
    newField.$parent = formDef;

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: formDef,
      properties: {
        fields: [...((formDef.fields || []) as ModdleElement[]), newField]
      }
    });
  };
}

/**
 * Create handler to remove a form field
 */
function createRemoveFormFieldHandler(
  commandStack: { execute: (cmd: string, ctx: Record<string, unknown>) => void },
  element: BpmnElement,
  field: ModdleElement
) {
  return function(event: Event) {
    event.stopPropagation();

    const formDef = getFormDefinition(element);
    if (!formDef) return;

    const newFields = ((formDef.fields || []) as ModdleElement[]).filter(f => f !== field);

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: formDef,
      properties: { fields: newFields }
    });
  };
}

/**
 * Import from I/O Mappings button component
 */
function ImportFromIOMappingsButton(props: { element: BpmnElement; id: string }) {
  const { element } = props;
  const translate = useService('translate');
  const bpmnFactory = useService('bpmnFactory');
  const commandStack = useService('commandStack');

  const bo = getBusinessObject(element)!;
  const inputMappings = getInputMappings(bo);
  const outputMappings = getOutputMappings(bo);
  const hasMappings = inputMappings.length > 0 || outputMappings.length > 0;
  const formFields = getFormFields(element);
  const hasFormFields = formFields.length > 0;

  if (!hasMappings || hasFormFields) return null;

  const buttonStyle = {
    width: '100%',
    padding: '4px 8px',
    background: 'var(--vscode-button-secondaryBackground, #3a3d41)',
    color: 'var(--vscode-button-secondaryForeground, #ccc)',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '11px'
  };

  const handleImport = () => {
    const formDef = ensureFormDefinition(element, bpmnFactory, commandStack);
    const fields: ModdleElement[] = [];

    // Import inputs
    for (const m of inputMappings) {
      if (!m.inputName) continue;
      const targetRef = m.assoc.targetRef as ModdleElement | undefined;
      const dtype = (targetRef as any)?.get?.('drools:dtype') || 'java.io.Serializable';
      const field = bpmnFactory.create('utform:FormField', {
        name: m.inputName,
        type: dtypeToFormType(String(dtype)),
        section: 'input'
      });
      field.$parent = formDef;
      fields.push(field);
    }

    // Import outputs
    for (const m of outputMappings) {
      if (!m.outputName) continue;
      const sourceRefs = (m.assoc.sourceRef || []) as (ModdleElement | string)[];
      let dtype = 'java.io.Serializable';
      if (sourceRefs.length > 0 && typeof sourceRefs[0] !== 'string') {
        dtype = (sourceRefs[0] as any)?.get?.('drools:dtype') || 'java.io.Serializable';
      }
      const field = bpmnFactory.create('utform:FormField', {
        name: m.outputName,
        type: dtypeToFormType(String(dtype)),
        section: 'output'
      });
      field.$parent = formDef;
      fields.push(field);
    }

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: formDef,
      properties: {
        fields: [...((formDef.fields || []) as ModdleElement[]), ...fields]
      }
    });
  };

  return html`
    <div style=${{ padding: '4px 10px' }}>
      <button
        type="button"
        style=${buttonStyle}
        onClick=${handleImport}
      >
        ${translate('Import from I/O Mappings')}
      </button>
    </div>
  `;
}

/**
 * Form Fields List Group
 */
function FormFieldsGroup(props: { element: BpmnElement; injector: { get: (name: string) => unknown } }) {
  const { element, injector } = props;

  if (!isUserTask(element)) return null;

  const bpmnFactory = injector.get('bpmnFactory') as { create: (type: string, attrs?: Record<string, unknown>) => ModdleElement };
  const commandStack = injector.get('commandStack') as { execute: (cmd: string, ctx: Record<string, unknown>) => void };
  const translate = injector.get('translate') as (text: string) => string;

  const fields = getFormFields(element);

  const items = fields.map((field: ModdleElement, index: number) => {
    const id = `${getBusinessObject(element)?.id || 'el'}-formField-${index}`;
    const name = (field.name as string) || '';
    const type = (field.type as string) || 'string';
    const section = (field.section as string) || 'input';
    return {
      id,
      label: name || translate('<unnamed>'),
      entries: FormFieldEntry({
        idPrefix: id,
        field,
        element
      }),
      autoFocusEntry: `${id}-name`,
      remove: createRemoveFormFieldHandler(commandStack, element, field)
    };
  });

  return {
    items,
    add: createAddFormFieldHandler(bpmnFactory, commandStack, element),
    label: translate('Form Fields')
  };
}

// ============================================================================
// Form Generation Components
// ============================================================================

// ============================================================================
// JSON Expansion Helpers (for complex defaultValue objects/arrays)
// ============================================================================

interface ExpandedField {
  name: string;
  dtype: string;
  variable?: string;
  defaultValue?: string;
  fieldKind?: 'flat' | 'object' | 'array';
  arrayItemFields?: Array<{ name: string; dtype: string; defaultValue?: string }>;
  objectFields?: ExpandedField[];
}

/**
 * Infer a Java dtype from a JS value's typeof.
 */
function inferDtype(value: unknown): string {
  if (typeof value === 'string') return 'java.lang.String';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'java.lang.Integer' : 'java.lang.Double';
  }
  if (typeof value === 'boolean') return 'java.lang.Boolean';
  return 'java.io.Serializable';
}

/**
 * Infer array item field schema from the first element of an array.
 * Returns an empty array if the array is empty or items are primitives.
 */
function inferArrayItemFields(arr: unknown[]): Array<{ name: string; dtype: string; defaultValue?: string }> {
  if (arr.length === 0) return [];
  const first = arr[0];
  if (first === null || typeof first !== 'object' || Array.isArray(first)) return [];

  const obj = first as Record<string, unknown>;
  return Object.keys(obj).map(key => ({
    name: key,
    dtype: inferDtype(obj[key])
  }));
}

/**
 * Expand a field with an object-typed defaultValue into structured sub-fields.
 * If the defaultValue is not valid JSON or not an object, pass through unchanged.
 */
function expandObjectField(field: { name: string; dtype: string; variable?: string; defaultValue?: string }): ExpandedField {
  if (!field.defaultValue) return field;

  // Only expand object-typed fields
  const normalized = field.dtype.replace(/^java\.lang\./, '').toLowerCase();
  if (normalized !== 'object') return field;

  let parsed: unknown;
  try {
    parsed = JSON.parse(field.defaultValue);
  } catch {
    return field;
  }

  if (parsed === null || typeof parsed !== 'object') return field;

  if (Array.isArray(parsed)) {
    // Top-level array
    const itemFields = inferArrayItemFields(parsed);
    if (itemFields.length === 0) return field; // primitives or empty → keep as textarea
    return {
      ...field,
      fieldKind: 'array',
      arrayItemFields: itemFields
    };
  }

  // Plain object — expand properties
  const obj = parsed as Record<string, unknown>;
  const objectFields: ExpandedField[] = [];

  for (const key of Object.keys(obj)) {
    const val = obj[key];

    if (Array.isArray(val)) {
      const itemFields = inferArrayItemFields(val);
      if (itemFields.length > 0) {
        objectFields.push({
          name: key,
          dtype: 'java.io.Serializable',
          defaultValue: JSON.stringify(val),
          fieldKind: 'array',
          arrayItemFields: itemFields
        });
      } else {
        objectFields.push({
          name: key,
          dtype: 'java.io.Serializable',
          defaultValue: JSON.stringify(val)
        });
      }
    } else if (val !== null && typeof val === 'object') {
      // Nested object — recurse
      const nested = expandObjectField({
        name: key,
        dtype: 'java.io.Serializable',
        defaultValue: JSON.stringify(val)
      });
      objectFields.push(nested);
    } else {
      objectFields.push({
        name: key,
        dtype: inferDtype(val),
        defaultValue: val !== null && val !== undefined ? String(val) : undefined
      });
    }
  }

  return {
    ...field,
    fieldKind: 'object',
    objectFields
  };
}

/**
 * Collect input/output field info and send a generateUserTaskForm message.
 * If form fields are defined (utform:FormDefinition), use those.
 * Otherwise, fall back to ioSpecification mappings.
 */
function requestGenerateForm(element: BpmnElement): void {
  const bo = getBusinessObject(element);
  if (!bo) return;

  const taskName = getConfigValue(bo, 'TaskName') || bo.name || 'UserTask';
  const taskId = bo.id || 'UserTask';

  const formDef = getFormDefinition(element);
  const formFields = formDef ? (formDef.fields || []) as ModdleElement[] : [];

  let inputs: Array<{ name: string; dtype: string; variable?: string; defaultValue?: string }>;
  let outputs: Array<{ name: string; dtype: string; variable?: string; defaultValue?: string }>;

  if (formFields.length > 0) {
    // Use user-defined form fields
    const varDefaults = getProcessVariableDefaults(element);

    const resolveDefault = (f: ModdleElement): string | undefined => {
      const fieldDefault = (f.defaultValue as string) || undefined;
      if (fieldDefault) return fieldDefault;
      const varName = (f.variable as string) || undefined;
      return varName ? varDefaults.get(varName) : undefined;
    };

    inputs = formFields
      .filter(f => (f.section || 'input') === 'input')
      .map(f => ({
        name: (f.name as string) || '',
        dtype: formTypeToDtype((f.type as string) || 'string'),
        variable: (f.variable as string) || undefined,
        defaultValue: resolveDefault(f)
      }))
      .filter(f => f.name);
    outputs = formFields
      .filter(f => f.section === 'output')
      .map(f => ({
        name: (f.name as string) || '',
        dtype: formTypeToDtype((f.type as string) || 'string'),
        variable: (f.variable as string) || undefined,
        defaultValue: resolveDefault(f)
      }))
      .filter(f => f.name);
  } else {
    // Fall back to ioSpecification mappings
    const inputMappings = getInputMappings(bo);
    inputs = inputMappings.map(m => {
      const targetRef = m.assoc.targetRef as ModdleElement | undefined;
      const dtype = (targetRef as any)?.get?.('drools:dtype') || 'java.io.Serializable';
      return { name: m.inputName, dtype: String(dtype) };
    }).filter(f => f.name);

    const outputMappings = getOutputMappings(bo);
    outputs = outputMappings.map(m => {
      const sourceRefs = (m.assoc.sourceRef || []) as (ModdleElement | string)[];
      let dtype = 'java.io.Serializable';
      if (sourceRefs.length > 0 && typeof sourceRefs[0] !== 'string') {
        dtype = (sourceRefs[0] as any)?.get?.('drools:dtype') || 'java.io.Serializable';
      }
      return { name: m.outputName, dtype: String(dtype) };
    }).filter(f => f.name);
  }

  // Expand complex JSON defaultValues into structured sub-fields
  const expandedInputs = inputs.map(expandObjectField);
  const expandedOutputs = outputs.map(expandObjectField);

  const vscode = (window as unknown as { vscodeApi?: { postMessage: (msg: unknown) => void } }).vscodeApi;
  if (vscode) {
    vscode.postMessage({
      type: 'generateUserTaskForm',
      taskId,
      taskName,
      inputs: expandedInputs,
      outputs: expandedOutputs
    });
  }
}

/**
 * Generate Form button component for properties panel.
 * Uses htm/preact tagged templates for proper Preact vdom rendering.
 */
function GenerateFormButton(props: { element: BpmnElement; id: string }) {
  const { element } = props;
  const translate = useService('translate');

  const bo = getBusinessObject(element)!;
  const formFields = getFormFields(element);
  const inputMappings = getInputMappings(bo);
  const outputMappings = getOutputMappings(bo);
  const hasFields = formFields.length > 0 || inputMappings.length > 0 || outputMappings.length > 0;

  const buttonStyle = {
    width: '100%',
    padding: '6px 12px',
    background: hasFields ? 'var(--vscode-button-background, #0e639c)' : 'var(--vscode-button-secondaryBackground, #3a3d41)',
    color: hasFields ? 'var(--vscode-button-foreground, #fff)' : 'var(--vscode-button-secondaryForeground, #ccc)',
    border: 'none',
    borderRadius: '3px',
    cursor: hasFields ? 'pointer' : 'not-allowed',
    fontSize: '12px'
  };

  const hintStyle = {
    marginTop: '6px',
    fontSize: '11px',
    color: 'var(--vscode-descriptionForeground, #717171)'
  };

  const sourceLabel = formFields.length > 0
    ? translate('Using Form Fields definitions')
    : translate('Using Data I/O mappings');

  return html`
    <div style=${{ padding: '8px 10px' }}>
      <button
        type="button"
        disabled=${!hasFields}
        style=${buttonStyle}
        onClick=${() => hasFields && requestGenerateForm(element)}
      >
        ${translate('Generate Form')}
      </button>
      ${!hasFields && html`
        <div style=${hintStyle}>${translate('Add Form Fields or Data I/O mappings first')}</div>
      `}
      ${hasFields && html`
        <div style=${hintStyle}>${sourceLabel}</div>
      `}
    </div>
  `;
}

// ============================================================================
// Properties Provider Class
// ============================================================================

export default class UserTaskPropertiesProvider {
  static $inject = ['propertiesPanel', 'injector'];

  private injector: { get: (name: string) => unknown };

  constructor(propertiesPanel: PropertiesPanel, injector: { get: (name: string) => unknown }) {
    this.injector = injector;
    propertiesPanel.registerProvider(500, this);
  }

  getGroups(element: BpmnElement) {
    return (groups: PropertiesGroup[]) => {
      if (!isUserTask(element)) {
        return groups;
      }

      // Add Task Configuration group
      groups.push({
        id: 'user-task-configuration',
        label: 'Task Configuration',
        entries: [
          { id: 'userTask-taskName', component: TaskNameField, isEdited: () => !!getConfigValue(getBusinessObject(element)!, 'TaskName') },
          { id: 'userTask-actors', component: ActorsField, isEdited: () => !!getConfigValue(getBusinessObject(element)!, 'ActorId') },
          { id: 'userTask-groups', component: GroupsField, isEdited: () => !!getConfigValue(getBusinessObject(element)!, 'GroupId') },
          { id: 'userTask-createdBy', component: CreatedByField, isEdited: () => !!getConfigValue(getBusinessObject(element)!, 'CreatedBy') },
          { id: 'userTask-skippable', component: SkippableField, isEdited: () => !!getConfigValue(getBusinessObject(element)!, 'Skippable') },
          { id: 'userTask-priority', component: PriorityField, isEdited: () => !!getConfigValue(getBusinessObject(element)!, 'Priority') }
        ]
      });

      // Add Data I/O Mappings as a ListGroup
      const dataIOGroup = DataIOMappingsGroup({ element, injector: this.injector });
      if (dataIOGroup) {
        groups.push({
          id: 'user-task-data-io',
          component: ListGroup,
          ...dataIOGroup
        });
      }

      // Add Form Fields as a ListGroup
      const formFieldsGroup = FormFieldsGroup({ element, injector: this.injector });
      if (formFieldsGroup) {
        groups.push({
          id: 'user-task-form-fields',
          component: ListGroup,
          ...formFieldsGroup
        });
      }

      // Add Form Generation group
      groups.push({
        id: 'user-task-form-generation',
        label: 'Form Generation',
        entries: [
          { id: 'userTask-generateForm', component: GenerateFormButton },
          { id: 'userTask-importFromIO', component: ImportFromIOMappingsButton }
        ]
      });

      return groups;
    };
  }
}
