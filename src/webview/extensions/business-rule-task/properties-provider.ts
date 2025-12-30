/**
 * Business Rule Task Properties Provider
 * Uses Kogito/jBPM compatible BPMN format for DMN decision linking
 *
 * Format:
 * - businessRuleTask with implementation="http://www.jboss.org/drools/dmn"
 * - ioSpecification with dataInputs: model, namespace, decision
 * - dataInputAssociation with assignments for values
 */

// @ts-expect-error - no type definitions available
import { TextFieldEntry, SelectEntry } from '@bpmn-io/properties-panel';
// @ts-expect-error - no type definitions available
import { useService } from 'bpmn-js-properties-panel';

import { DMN_IMPLEMENTATION_URI, DMN_DATA_INPUTS } from './moddle-descriptor';

// Interface for DMN file information
export interface DmnFileInfo {
  path: string;
  name: string;
  namespace?: string;
  decisions: Array<{
    id: string;
    name: string;
  }>;
}

// Store for available DMN files (populated via messages from extension)
let availableDmnFiles: DmnFileInfo[] = [];

// Function to update available DMN files (called from webview message handler)
export function setAvailableDmnFiles(files: DmnFileInfo[]): void {
  availableDmnFiles = files;
}

// Function to get available DMN files
export function getAvailableDmnFiles(): DmnFileInfo[] {
  return availableDmnFiles;
}

// Helper to check if element is a Business Rule Task
function isBusinessRuleTask(element: any): boolean {
  return element?.businessObject?.$type === 'bpmn:BusinessRuleTask';
}

// Helper to check if business rule task has DMN implementation
function hasDmnImplementation(element: any): boolean {
  const bo = element?.businessObject;
  return bo?.implementation === DMN_IMPLEMENTATION_URI;
}

// Helper to get data input value from ioSpecification
function getDataInputValue(element: any, inputName: string): string {
  const bo = element?.businessObject;
  if (!bo) return '';

  // First check for legacy dmn:DecisionTaskConfig format
  const legacyConfig = getLegacyDecisionConfig(element);
  if (legacyConfig) {
    if (inputName === DMN_DATA_INPUTS.MODEL) return legacyConfig.dmnFileName || legacyConfig.dmnFile || '';
    if (inputName === DMN_DATA_INPUTS.DECISION) return legacyConfig.decisionRef || '';
    if (inputName === DMN_DATA_INPUTS.NAMESPACE) return '';
  }

  // Look in dataInputAssociations
  const associations = bo.dataInputAssociations || [];
  for (const assoc of associations) {
    const targetRef = assoc.targetRef;
    if (targetRef?.name === inputName) {
      // Get value from assignment
      const assignment = assoc.assignment?.[0];
      if (assignment?.from?.body !== undefined) {
        return assignment.from.body;
      }
    }
  }

  return '';
}

// Helper to get legacy DecisionTaskConfig (for backward compatibility)
function getLegacyDecisionConfig(element: any): any {
  const bo = element?.businessObject;
  if (!bo) return null;

  const extensionElements = bo.extensionElements || bo.get?.('extensionElements');
  if (!extensionElements) return null;

  const values = extensionElements.values || extensionElements.get?.('values') || [];
  return values.find((ext: any) => ext.$type === 'dmn:DecisionTaskConfig');
}

// Helper to ensure ioSpecification and data inputs exist
function ensureIoSpecification(element: any, bpmnFactory: any, commandStack: any): any {
  const bo = element.businessObject;
  const taskId = bo.id;

  // Check if ioSpecification already exists
  let ioSpec = bo.ioSpecification;
  if (ioSpec) {
    return ioSpec;
  }

  // Create data inputs
  const dataInputs: any[] = [];
  const dataInputRefs: any[] = [];

  for (const inputName of [DMN_DATA_INPUTS.MODEL, DMN_DATA_INPUTS.NAMESPACE, DMN_DATA_INPUTS.DECISION]) {
    const dataInput = bpmnFactory.create('bpmn:DataInput', {
      id: `${taskId}_${inputName}Input`,
      name: inputName
    });
    dataInputs.push(dataInput);
    dataInputRefs.push(dataInput);
  }

  // Create input set
  const inputSet = bpmnFactory.create('bpmn:InputSet', {
    id: `${taskId}_InputSet`,
    dataInputRefs: dataInputRefs
  });

  // Create output set (empty for now)
  const outputSet = bpmnFactory.create('bpmn:OutputSet', {
    id: `${taskId}_OutputSet`,
    dataOutputRefs: []
  });

  // Create ioSpecification
  ioSpec = bpmnFactory.create('bpmn:InputOutputSpecification', {
    id: `${taskId}_IoSpec`,
    dataInputs: dataInputs,
    dataOutputs: [],
    inputSets: [inputSet],
    outputSets: [outputSet]
  });

  // Set parent references
  dataInputs.forEach(di => { di.$parent = ioSpec; });
  inputSet.$parent = ioSpec;
  outputSet.$parent = ioSpec;
  ioSpec.$parent = bo;

  // Create data input associations with empty values
  const dataInputAssociations: any[] = [];
  for (const dataInput of dataInputs) {
    const fromExpression = bpmnFactory.create('bpmn:FormalExpression', { body: '' });
    const toExpression = bpmnFactory.create('bpmn:FormalExpression', { body: dataInput.id });
    const assignment = bpmnFactory.create('bpmn:Assignment', {
      from: fromExpression,
      to: toExpression
    });
    const association = bpmnFactory.create('bpmn:DataInputAssociation', {
      id: `${taskId}_${dataInput.name}Association`,
      targetRef: dataInput,
      assignment: [assignment]
    });
    assignment.$parent = association;
    association.$parent = bo;
    dataInputAssociations.push(association);
  }

  // Update element with new ioSpecification and associations
  commandStack.execute('element.updateModdleProperties', {
    element,
    moddleElement: bo,
    properties: {
      implementation: DMN_IMPLEMENTATION_URI,
      ioSpecification: ioSpec,
      dataInputAssociations: dataInputAssociations
    }
  });

  return ioSpec;
}

// Helper to update a data input value
function setDataInputValue(element: any, inputName: string, value: string, bpmnFactory: any, commandStack: any): void {
  const bo = element.businessObject;

  // Ensure ioSpecification exists
  ensureIoSpecification(element, bpmnFactory, commandStack);

  // Find the association for this input
  const associations = bo.dataInputAssociations || [];
  for (const assoc of associations) {
    const targetRef = assoc.targetRef;
    if (targetRef?.name === inputName) {
      const assignment = assoc.assignment?.[0];
      if (assignment?.from) {
        // Update the from expression
        commandStack.execute('element.updateModdleProperties', {
          element,
          moddleElement: assignment.from,
          properties: { body: value }
        });
        return;
      }
    }
  }
}

// Remove legacy DecisionTaskConfig and migrate to new format
function migrateLegacyConfig(element: any, bpmnFactory: any, commandStack: any): void {
  const legacyConfig = getLegacyDecisionConfig(element);
  if (!legacyConfig) return;

  const bo = element.businessObject;

  // Extract values from legacy config
  const model = legacyConfig.dmnFileName || legacyConfig.dmnFile || '';
  const decision = legacyConfig.decisionRef || '';

  // Remove the legacy extension element
  const extensionElements = bo.extensionElements;
  if (extensionElements?.values) {
    const newValues = extensionElements.values.filter((ext: any) => ext.$type !== 'dmn:DecisionTaskConfig');
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: extensionElements,
      properties: { values: newValues }
    });
  }

  // Ensure new format is set up
  ensureIoSpecification(element, bpmnFactory, commandStack);

  // Set the migrated values
  if (model) setDataInputValue(element, DMN_DATA_INPUTS.MODEL, model, bpmnFactory, commandStack);
  if (decision) setDataInputValue(element, DMN_DATA_INPUTS.DECISION, decision, bpmnFactory, commandStack);
}

// DMN File Select component
function DmnFileSelect(props: { element: any; id: string }) {
  const { element, id } = props;
  const commandStack = useService('commandStack');
  const bpmnFactory = useService('bpmnFactory');
  const translate = useService('translate');
  const debounce = useService('debounceInput');

  const getValue = () => {
    return getDataInputValue(element, DMN_DATA_INPUTS.MODEL);
  };

  const setValue = (value: string) => {
    // Migrate legacy config if present
    migrateLegacyConfig(element, bpmnFactory, commandStack);

    // Ensure ioSpecification exists
    ensureIoSpecification(element, bpmnFactory, commandStack);

    // Set the model value
    setDataInputValue(element, DMN_DATA_INPUTS.MODEL, value, bpmnFactory, commandStack);

    // Find the selected file to get its namespace
    const selectedFile = availableDmnFiles.find(f => f.name === value);
    if (selectedFile?.namespace) {
      setDataInputValue(element, DMN_DATA_INPUTS.NAMESPACE, selectedFile.namespace, bpmnFactory, commandStack);
    }

    // Clear decision when file changes
    setDataInputValue(element, DMN_DATA_INPUTS.DECISION, '', bpmnFactory, commandStack);
  };

  const getOptions = () => {
    const options = [
      { value: '', label: translate('-- Select DMN File --') }
    ];

    for (const file of availableDmnFiles) {
      options.push({
        value: file.name,
        label: file.name
      });
    }

    return options;
  };

  return SelectEntry({
    id,
    element,
    label: translate('DMN File'),
    description: translate('Select the DMN file containing the decision'),
    getValue,
    setValue,
    getOptions,
    debounce
  });
}

// Decision Select component
function DecisionSelect(props: { element: any; id: string }) {
  const { element, id } = props;
  const commandStack = useService('commandStack');
  const bpmnFactory = useService('bpmnFactory');
  const translate = useService('translate');
  const debounce = useService('debounceInput');

  const getValue = () => {
    return getDataInputValue(element, DMN_DATA_INPUTS.DECISION);
  };

  const setValue = (value: string) => {
    // Migrate legacy config if present
    migrateLegacyConfig(element, bpmnFactory, commandStack);

    setDataInputValue(element, DMN_DATA_INPUTS.DECISION, value, bpmnFactory, commandStack);
  };

  const getOptions = () => {
    const currentFile = getDataInputValue(element, DMN_DATA_INPUTS.MODEL);

    const options = [
      { value: '', label: translate('-- Select Decision --') }
    ];

    if (currentFile) {
      // Match by relative path (name)
      const selectedFile = availableDmnFiles.find(f =>
        f.name === currentFile ||
        f.path === currentFile ||
        f.name.endsWith(currentFile) ||
        currentFile.endsWith(f.name)
      );
      if (selectedFile?.decisions) {
        for (const decision of selectedFile.decisions) {
          options.push({
            value: decision.id,
            label: decision.name || decision.id
          });
        }
      }
    }

    return options;
  };

  return SelectEntry({
    id,
    element,
    label: translate('Decision'),
    description: translate('Select the decision to invoke'),
    getValue,
    setValue,
    getOptions,
    debounce
  });
}

// DMN Namespace component (read-only, auto-populated)
function DmnNamespace(props: { element: any; id: string }) {
  const { element, id } = props;
  const translate = useService('translate');
  const debounce = useService('debounceInput');

  const getValue = () => {
    return getDataInputValue(element, DMN_DATA_INPUTS.NAMESPACE);
  };

  const setValue = () => {
    // Read-only - namespace is auto-populated when selecting DMN file
  };

  return TextFieldEntry({
    id,
    element,
    label: translate('DMN Namespace'),
    description: translate('Namespace of the DMN model (auto-populated)'),
    getValue,
    setValue,
    debounce,
    disabled: true
  });
}

// Create entries for Business Rule Task
function BusinessRuleTaskEntries(props: { element: any }): any[] {
  const { element } = props;

  if (!isBusinessRuleTask(element)) {
    return [];
  }

  return [
    {
      id: 'dmnFile',
      component: DmnFileSelect,
      isEdited: () => !!getDataInputValue(element, DMN_DATA_INPUTS.MODEL)
    },
    {
      id: 'dmnDecision',
      component: DecisionSelect,
      isEdited: () => !!getDataInputValue(element, DMN_DATA_INPUTS.DECISION)
    },
    {
      id: 'dmnNamespace',
      component: DmnNamespace,
      isEdited: () => !!getDataInputValue(element, DMN_DATA_INPUTS.NAMESPACE)
    }
  ];
}

// Request DMN files from extension
function requestDmnFiles(): void {
  const vscode = (window as any).vscodeApi;
  if (vscode) {
    console.log('[BAMOE Webview] Requesting DMN files...');
    vscode.postMessage({ type: 'requestDmnFiles' });
  } else {
    console.warn('[BAMOE Webview] vscodeApi not available');
  }
}

// Provider class
export default class BusinessRuleTaskPropertiesProvider {
  static $inject = ['propertiesPanel', 'eventBus'];

  constructor(propertiesPanel: any, eventBus: any) {
    // Request DMN files on initialization
    requestDmnFiles();

    // Re-request when selection changes to a business rule task
    eventBus.on('selection.changed', (event: any) => {
      const selected = event.newSelection?.[0];
      if (selected && isBusinessRuleTask(selected)) {
        requestDmnFiles();
      }
    });

    propertiesPanel.registerProvider(500, this);
  }

  getGroups(element: any) {
    return (groups: any[]) => {
      if (!isBusinessRuleTask(element)) {
        return groups;
      }

      // Add DMN Decision Configuration group
      groups.push({
        id: 'dmn-decision-configuration',
        label: 'DMN Decision Configuration',
        entries: BusinessRuleTaskEntries({ element })
      });

      return groups;
    };
  }
}
