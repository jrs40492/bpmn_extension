/**
 * User Task Properties Provider
 * Adds task configuration and data I/O mappings to the properties panel for User Tasks.
 *
 * User task config (TaskName, ActorId, GroupId, etc.) is stored as assignment-based
 * dataInputAssociation entries inside ioSpecification (jBPM/Kogito convention).
 * Data I/O mappings use sourceRef/targetRef patterns to bind process variables.
 */

// @ts-expect-error - no type definitions available
import { TextFieldEntry, CheckboxEntry, ListGroup } from '@bpmn-io/properties-panel';
// @ts-expect-error - no type definitions available
import { useService } from 'bpmn-js-properties-panel';

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
    (dataInput as any).set('drools:dtype', 'java.lang.Object');

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

      return groups;
    };
  }
}
