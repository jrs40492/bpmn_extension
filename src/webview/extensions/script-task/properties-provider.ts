/**
 * Script Task Properties Provider
 * Adds scriptFormat and script properties to the properties panel for Script Tasks
 */

// @ts-expect-error - no type definitions available
import { TextAreaEntry, SelectEntry } from '@bpmn-io/properties-panel';
// @ts-expect-error - no type definitions available
import { useService } from 'bpmn-js-properties-panel';

// Helper to check if element is a Script Task
function isScriptTask(element: any): boolean {
  return element?.businessObject?.$type === 'bpmn:ScriptTask';
}

// Helper to get business object
function getBusinessObject(element: any): any {
  return element?.businessObject;
}

// Script Language Select component
function ScriptFormat(props: { element: any; id: string }) {
  const { element, id } = props;
  const commandStack = useService('commandStack');
  const translate = useService('translate');
  const debounce = useService('debounceInput');

  const businessObject = getBusinessObject(element);

  const getValue = () => {
    return businessObject?.scriptFormat || '';
  };

  const setValue = (value: string) => {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: businessObject,
      properties: {
        scriptFormat: value || undefined
      }
    });
  };

  const getOptions = () => [
    { value: '', label: translate('(Select language)') },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'groovy', label: 'Groovy' },
    { value: 'java', label: 'Java' },
    { value: 'mvel', label: 'MVEL' },
    { value: 'python', label: 'Python' },
    { value: 'ruby', label: 'Ruby' }
  ];

  return SelectEntry({
    id,
    element,
    label: translate('Script Language'),
    getValue,
    setValue,
    getOptions,
    debounce
  });
}

// Script Content TextArea component
function ScriptContent(props: { element: any; id: string }) {
  const { element, id } = props;
  const commandStack = useService('commandStack');
  const translate = useService('translate');
  const debounce = useService('debounceInput');

  const businessObject = getBusinessObject(element);

  const getValue = () => {
    return businessObject?.script || '';
  };

  const setValue = (value: string) => {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: businessObject,
      properties: {
        script: value || ''
      }
    });
  };

  return TextAreaEntry({
    id,
    element,
    label: translate('Script'),
    description: translate('The script code to execute'),
    getValue,
    setValue,
    debounce,
    monospace: true,
    rows: 8
  });
}

// Create entries for Script Task
function ScriptTaskEntries(props: { element: any }) {
  const { element } = props;

  if (!isScriptTask(element)) {
    return [];
  }

  return [
    {
      id: 'scriptFormat',
      component: ScriptFormat,
      isEdited: (element: any) => !!getBusinessObject(element)?.scriptFormat
    },
    {
      id: 'script',
      component: ScriptContent,
      isEdited: (element: any) => !!getBusinessObject(element)?.script
    }
  ];
}

// Provider class
export default class ScriptTaskPropertiesProvider {
  static $inject = ['propertiesPanel'];

  constructor(propertiesPanel: any) {
    propertiesPanel.registerProvider(500, this);
  }

  getGroups(element: any) {
    return (groups: any[]) => {
      if (!isScriptTask(element)) {
        return groups;
      }

      // Add Script Configuration group
      groups.push({
        id: 'script-configuration',
        label: 'Script Configuration',
        entries: ScriptTaskEntries({ element })
      });

      return groups;
    };
  }
}
