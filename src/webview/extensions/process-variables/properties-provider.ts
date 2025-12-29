/**
 * Process Variables Properties Provider
 * Adds input parameter/variable configuration to the Process element
 */

// @ts-expect-error - no type definitions available
import { ListGroup, TextFieldEntry, SelectEntry, CheckboxEntry } from '@bpmn-io/properties-panel';
// @ts-expect-error - no type definitions available
import { useService } from 'bpmn-js-properties-panel';

// Helper to check if element is a Process
function isProcess(element: any): boolean {
  return element?.businessObject?.$type === 'bpmn:Process';
}

// Helper to get business object
function getBusinessObject(element: any): any {
  return element?.businessObject;
}

// Get process variables container from element
function getProcessVariables(element: any): any {
  const bo = getBusinessObject(element);
  if (!bo) return null;

  const extensionElements = bo.extensionElements;
  if (!extensionElements) return null;

  const values = extensionElements.values || [];
  return values.find((ext: any) => ext.$type === 'bamoe:ProcessVariables');
}

// Get list of variables
function getVariables(element: any): any[] {
  const processVariables = getProcessVariables(element);
  return processVariables?.variables || [];
}

// Variable entry component - renders the fields for a single variable
function VariableEntry(props: { idPrefix: string; variable: any; element: any }) {
  const { idPrefix, variable, element } = props;

  const entries = [
    {
      id: `${idPrefix}-name`,
      component: VariableName,
      variable,
      idPrefix,
      element
    },
    {
      id: `${idPrefix}-type`,
      component: VariableType,
      variable,
      idPrefix,
      element
    },
    {
      id: `${idPrefix}-required`,
      component: VariableRequired,
      variable,
      idPrefix,
      element
    },
    {
      id: `${idPrefix}-defaultValue`,
      component: VariableDefaultValue,
      variable,
      idPrefix,
      element
    },
    {
      id: `${idPrefix}-description`,
      component: VariableDescription,
      variable,
      idPrefix,
      element
    }
  ];

  return entries;
}

// Variable Name field
function VariableName(props: { id: string; variable: any; element: any }) {
  const { id, variable, element } = props;
  const commandStack = useService('commandStack');
  const translate = useService('translate');
  const debounce = useService('debounceInput');

  const getValue = () => variable.name || '';

  const setValue = (value: string) => {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: variable,
      properties: { name: value }
    });
  };

  return TextFieldEntry({
    id,
    element,
    label: translate('Name'),
    getValue,
    setValue,
    debounce
  });
}

// Variable Type field
function VariableType(props: { id: string; variable: any; element: any }) {
  const { id, variable, element } = props;
  const commandStack = useService('commandStack');
  const translate = useService('translate');

  const getValue = () => variable.type || 'string';

  const setValue = (value: string) => {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: variable,
      properties: { type: value }
    });
  };

  const getOptions = () => [
    { value: 'string', label: translate('String') },
    { value: 'number', label: translate('Number') },
    { value: 'boolean', label: translate('Boolean') },
    { value: 'object', label: translate('Object') },
    { value: 'array', label: translate('Array') }
  ];

  return SelectEntry({
    id,
    element,
    label: translate('Type'),
    getValue,
    setValue,
    getOptions
  });
}

// Variable Required field
function VariableRequired(props: { id: string; variable: any; element: any }) {
  const { id, variable, element } = props;
  const commandStack = useService('commandStack');
  const translate = useService('translate');

  const getValue = () => variable.required || false;

  const setValue = (value: boolean) => {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: variable,
      properties: { required: value }
    });
  };

  return CheckboxEntry({
    id,
    element,
    label: translate('Required'),
    getValue,
    setValue
  });
}

// Variable Default Value field
function VariableDefaultValue(props: { id: string; variable: any; element: any }) {
  const { id, variable, element } = props;
  const commandStack = useService('commandStack');
  const translate = useService('translate');
  const debounce = useService('debounceInput');

  const getValue = () => variable.defaultValue || '';

  const setValue = (value: string) => {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: variable,
      properties: { defaultValue: value || undefined }
    });
  };

  return TextFieldEntry({
    id,
    element,
    label: translate('Default Value'),
    getValue,
    setValue,
    debounce
  });
}

// Variable Description field
function VariableDescription(props: { id: string; variable: any; element: any }) {
  const { id, variable, element } = props;
  const commandStack = useService('commandStack');
  const translate = useService('translate');
  const debounce = useService('debounceInput');

  const getValue = () => variable.description || '';

  const setValue = (value: string) => {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: variable,
      properties: { description: value || undefined }
    });
  };

  return TextFieldEntry({
    id,
    element,
    label: translate('Description'),
    getValue,
    setValue,
    debounce
  });
}

// Process Variables List Group
function ProcessVariablesGroup(props: { element: any; injector: any }) {
  const { element, injector } = props;

  if (!isProcess(element)) {
    return null;
  }

  const bpmnFactory = injector.get('bpmnFactory');
  const commandStack = injector.get('commandStack');
  const translate = injector.get('translate');

  const variables = getVariables(element);

  const items = variables.map((variable: any, index: number) => {
    const id = `${element.id}-variable-${index}`;
    return {
      id,
      label: variable.name || translate('<unnamed>'),
      entries: VariableEntry({
        idPrefix: id,
        variable,
        element
      }),
      autoFocusEntry: `${id}-name`,
      remove: createRemoveHandler(commandStack, element, variable)
    };
  });

  return {
    items,
    add: createAddHandler(bpmnFactory, commandStack, element),
    label: translate('Process Variables')
  };
}

// Create handler to remove a variable
function createRemoveHandler(commandStack: any, element: any, variable: any) {
  return function(event: Event) {
    event.stopPropagation();

    const processVariables = getProcessVariables(element);
    if (!processVariables) return;

    const newVariables = processVariables.variables.filter((v: any) => v !== variable);

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: processVariables,
      properties: {
        variables: newVariables
      }
    });
  };
}

// Create handler to add a new variable
function createAddHandler(bpmnFactory: any, commandStack: any, element: any) {
  return function(event: Event) {
    event.stopPropagation();

    const bo = getBusinessObject(element);
    const commands: any[] = [];

    // Ensure extensionElements exists
    let extensionElements = bo.extensionElements;
    if (!extensionElements) {
      extensionElements = bpmnFactory.create('bpmn:ExtensionElements', { values: [] });
      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          element,
          moddleElement: bo,
          properties: { extensionElements }
        }
      });
    }

    // Ensure ProcessVariables container exists
    let processVariables = getProcessVariables(element);
    if (!processVariables) {
      processVariables = bpmnFactory.create('bamoe:ProcessVariables', { variables: [] });
      processVariables.$parent = extensionElements;

      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          element,
          moddleElement: extensionElements,
          properties: {
            values: [...(extensionElements.values || []), processVariables]
          }
        }
      });
    }

    // Create new variable
    const newVariable = bpmnFactory.create('bamoe:Variable', {
      name: '',
      type: 'string',
      required: false
    });
    newVariable.$parent = processVariables;

    // Add variable to list
    commands.push({
      cmd: 'element.updateModdleProperties',
      context: {
        element,
        moddleElement: processVariables,
        properties: {
          variables: [...(processVariables.variables || []), newVariable]
        }
      }
    });

    // Execute all commands
    commandStack.execute('properties-panel.multi-command-executor', commands);
  };
}

// Provider class
export default class ProcessVariablesPropertiesProvider {
  static $inject = ['propertiesPanel', 'injector'];

  private injector: any;

  constructor(propertiesPanel: any, injector: any) {
    this.injector = injector;
    propertiesPanel.registerProvider(500, this);
  }

  getGroups(element: any) {
    return (groups: any[]) => {
      if (!isProcess(element)) {
        return groups;
      }

      // Add Process Variables as a ListGroup
      const variablesGroup = ProcessVariablesGroup({ element, injector: this.injector });
      if (variablesGroup) {
        groups.push({
          id: 'process-variables',
          component: ListGroup,
          ...variablesGroup
        });
      }

      return groups;
    };
  }
}
