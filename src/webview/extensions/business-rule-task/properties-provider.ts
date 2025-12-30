/**
 * Business Rule Task Properties Provider
 * Adds DMN decision linking properties to the properties panel
 */

// @ts-expect-error - no type definitions available
import { TextFieldEntry, SelectEntry } from '@bpmn-io/properties-panel';
// @ts-expect-error - no type definitions available
import { useService } from 'bpmn-js-properties-panel';

// Interface for DMN file information
export interface DmnFileInfo {
  path: string;
  name: string;
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

// Helper to get decision config from element
function getDecisionConfig(element: any): any {
  const bo = element?.businessObject;
  if (!bo) return null;

  const extensionElements = bo.extensionElements || bo.get?.('extensionElements');
  if (!extensionElements) return null;

  const values = extensionElements.values || extensionElements.get?.('values') || [];
  return values.find((ext: any) => ext.$type === 'dmn:DecisionTaskConfig');
}

// Helper to get or create decision config
function getOrCreateDecisionConfig(element: any, bpmnFactory: any, commandStack: any): any {
  let config = getDecisionConfig(element);

  if (!config) {
    const bo = element.businessObject;

    // Create decision config
    config = bpmnFactory.create('dmn:DecisionTaskConfig', {
      decisionRef: '',
      dmnFile: '',
      dmnFileName: '',
      resultVariable: 'decisionResult',
      mapDecisionResult: 'singleResult',
      decisionRefBinding: 'latest'
    });

    // Get or create extension elements
    let extensionElements = bo.extensionElements;
    if (!extensionElements) {
      extensionElements = bpmnFactory.create('bpmn:ExtensionElements', { values: [] });
    }

    // Add config to extension elements
    config.$parent = extensionElements;
    const values = extensionElements.values || [];
    values.push(config);

    // Update the element
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: bo,
      properties: {
        extensionElements
      }
    });
  }

  return config;
}

// DMN File Select component
function DmnFileSelect(props: { element: any; id: string }) {
  const { element, id } = props;
  const commandStack = useService('commandStack');
  const bpmnFactory = useService('bpmnFactory');
  const translate = useService('translate');
  const debounce = useService('debounceInput');

  const getValue = () => {
    const config = getDecisionConfig(element);
    return config?.dmnFile || '';
  };

  const setValue = (value: string) => {
    const config = getOrCreateDecisionConfig(element, bpmnFactory, commandStack);
    const selectedFile = availableDmnFiles.find(f => f.path === value);

    // Update config properties
    config.dmnFile = value || '';
    config.dmnFileName = selectedFile?.name || '';
    // Clear decision when file changes
    config.decisionRef = '';

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: config,
      properties: {
        dmnFile: value || '',
        dmnFileName: selectedFile?.name || '',
        decisionRef: ''
      }
    });
  };

  const getOptions = () => {
    const options = [
      { value: '', label: translate('-- Select DMN File --') }
    ];

    for (const file of availableDmnFiles) {
      options.push({
        value: file.path,
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
    const config = getDecisionConfig(element);
    return config?.decisionRef || '';
  };

  const setValue = (value: string) => {
    const config = getOrCreateDecisionConfig(element, bpmnFactory, commandStack);

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: config,
      properties: {
        decisionRef: value || ''
      }
    });
  };

  const getOptions = () => {
    const config = getDecisionConfig(element);
    const currentFile = config?.dmnFile || '';

    const options = [
      { value: '', label: translate('-- Select Decision --') }
    ];

    if (currentFile) {
      const selectedFile = availableDmnFiles.find(f => f.path === currentFile);
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

// Result Variable component
function ResultVariable(props: { element: any; id: string }) {
  const { element, id } = props;
  const commandStack = useService('commandStack');
  const bpmnFactory = useService('bpmnFactory');
  const translate = useService('translate');
  const debounce = useService('debounceInput');

  const getValue = () => {
    const config = getDecisionConfig(element);
    return config?.resultVariable || 'decisionResult';
  };

  const setValue = (value: string) => {
    const config = getOrCreateDecisionConfig(element, bpmnFactory, commandStack);

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: config,
      properties: {
        resultVariable: value || 'decisionResult'
      }
    });
  };

  return TextFieldEntry({
    id,
    element,
    label: translate('Result Variable'),
    description: translate('Variable to store the decision result'),
    getValue,
    setValue,
    debounce
  });
}

// Map Decision Result component
function MapDecisionResult(props: { element: any; id: string }) {
  const { element, id } = props;
  const commandStack = useService('commandStack');
  const bpmnFactory = useService('bpmnFactory');
  const translate = useService('translate');
  const debounce = useService('debounceInput');

  const getValue = () => {
    const config = getDecisionConfig(element);
    return config?.mapDecisionResult || 'singleResult';
  };

  const setValue = (value: string) => {
    const config = getOrCreateDecisionConfig(element, bpmnFactory, commandStack);

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: config,
      properties: {
        mapDecisionResult: value || 'singleResult'
      }
    });
  };

  const getOptions = () => [
    { value: 'singleEntry', label: translate('Single Entry (one value)') },
    { value: 'singleResult', label: translate('Single Result (one row)') },
    { value: 'collectEntries', label: translate('Collect Entries (list of values)') },
    { value: 'resultList', label: translate('Result List (all rows)') }
  ];

  return SelectEntry({
    id,
    element,
    label: translate('Map Decision Result'),
    description: translate('How to map the decision output'),
    getValue,
    setValue,
    getOptions,
    debounce
  });
}

// Decision Binding component
function DecisionBinding(props: { element: any; id: string }) {
  const { element, id } = props;
  const commandStack = useService('commandStack');
  const bpmnFactory = useService('bpmnFactory');
  const translate = useService('translate');
  const debounce = useService('debounceInput');

  const getValue = () => {
    const config = getDecisionConfig(element);
    return config?.decisionRefBinding || 'latest';
  };

  const setValue = (value: string) => {
    const config = getOrCreateDecisionConfig(element, bpmnFactory, commandStack);

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: config,
      properties: {
        decisionRefBinding: value || 'latest'
      }
    });
  };

  const getOptions = () => [
    { value: 'latest', label: translate('Latest Version') },
    { value: 'deployment', label: translate('Deployment') },
    { value: 'version', label: translate('Specific Version') }
  ];

  return SelectEntry({
    id,
    element,
    label: translate('Decision Binding'),
    description: translate('How to resolve the decision reference'),
    getValue,
    setValue,
    getOptions,
    debounce
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
      isEdited: () => !!getDecisionConfig(element)?.dmnFile
    },
    {
      id: 'decisionRef',
      component: DecisionSelect,
      isEdited: () => !!getDecisionConfig(element)?.decisionRef
    },
    {
      id: 'resultVariable',
      component: ResultVariable,
      isEdited: () => {
        const config = getDecisionConfig(element);
        return config?.resultVariable && config.resultVariable !== 'decisionResult';
      }
    },
    {
      id: 'mapDecisionResult',
      component: MapDecisionResult,
      isEdited: () => {
        const config = getDecisionConfig(element);
        return config?.mapDecisionResult && config.mapDecisionResult !== 'singleResult';
      }
    },
    {
      id: 'decisionRefBinding',
      component: DecisionBinding,
      isEdited: () => {
        const config = getDecisionConfig(element);
        return config?.decisionRefBinding && config.decisionRefBinding !== 'latest';
      }
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
