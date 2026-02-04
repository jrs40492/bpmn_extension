/**
 * Script Task Properties Provider
 * Adds scriptFormat and script properties to the properties panel for Script Tasks
 */

// Type definitions for properties panel components
// @ts-expect-error - no type definitions available
import type { TextAreaEntry as TextAreaEntryFn, SelectEntry as SelectEntryFn } from '@bpmn-io/properties-panel';
// @ts-expect-error - no type definitions available
import type { useService as useServiceFn } from 'bpmn-js-properties-panel';

// @ts-expect-error - no type definitions available
import { TextAreaEntry, SelectEntry } from '@bpmn-io/properties-panel';
// @ts-expect-error - no type definitions available
import { useService } from 'bpmn-js-properties-panel';

// Extended types for properties panel entries that include runtime-supported properties
interface ExtendedSelectEntryProps {
  id: string;
  element: unknown;
  label: string;
  description?: string;
  getValue: () => string;
  setValue: (value: string) => void;
  getOptions: () => Array<{ value: string; label: string }>;
}

// ============================================================================
// BPMN-JS Type Definitions (no official types available)
// ============================================================================

interface ModdleElement {
  $type: string;
  $parent?: ModdleElement;
}

interface ScriptTaskBusinessObject extends ModdleElement {
  scriptFormat?: string;
  script?: string;
}

interface BpmnElement {
  businessObject?: ScriptTaskBusinessObject;
}

interface CommandStack {
  execute(command: string, context: Record<string, unknown>): void;
}

interface PropertiesPanel {
  registerProvider(priority: number, provider: unknown): void;
}

interface PropertyEntry {
  id: string;
  component: (props: { element: BpmnElement; id: string }) => unknown;
  isEdited: (element: BpmnElement) => boolean;
}

interface PropertiesGroup {
  id: string;
  label: string;
  entries: PropertyEntry[];
}

// ============================================================================
// Helper Functions
// ============================================================================

// Helper to check if element is a Script Task
function isScriptTask(element: BpmnElement): boolean {
  return element?.businessObject?.$type === 'bpmn:ScriptTask';
}

// Helper to get business object
function getBusinessObject(element: BpmnElement): ScriptTaskBusinessObject | undefined {
  return element?.businessObject;
}

// ============================================================================
// Property Panel Components
// ============================================================================

// Script Language Select component
function ScriptFormat(props: { element: BpmnElement; id: string }) {
  const { element, id } = props;
  const commandStack = useService('commandStack') as CommandStack;
  const translate = useService('translate') as (text: string) => string;
  const debounce = useService('debounceInput') as <T>(fn: T) => T;

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
    getOptions
  } as ExtendedSelectEntryProps);
}

/**
 * Validate Java script for common errors that cause Kogito/jBPM compilation failures.
 * Returns an error message if invalid, or null if valid.
 */
function validateJavaScript(script: string, scriptFormat: string): string | null {
  if (!script || scriptFormat !== 'java') {
    return null;
  }

  // Check for return statements - Java script tasks execute in a void context
  // and cannot return values. This causes "incompatible types: unexpected return value" errors.
  const returnPattern = /\breturn\s+[^;]+;/;
  if (returnPattern.test(script)) {
    return 'Java script tasks cannot use "return" statements. Use kcontext.setVariable("varName", value) instead.';
  }

  return null;
}

// Script Content TextArea component
function ScriptContent(props: { element: BpmnElement; id: string }) {
  const { element, id } = props;
  const commandStack = useService('commandStack') as CommandStack;
  const translate = useService('translate') as (text: string) => string;
  const debounce = useService('debounceInput') as <T>(fn: T) => T;

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

  // Validate and get description with warning if needed
  const getDescription = () => {
    const script = businessObject?.script || '';
    const scriptFormat = businessObject?.scriptFormat || '';
    const validationError = validateJavaScript(script, scriptFormat);

    if (validationError) {
      return translate('⚠️ WARNING: ') + validationError;
    }
    return translate('The script code to execute');
  };

  return TextAreaEntry({
    id,
    element,
    label: translate('Script'),
    description: getDescription(),
    getValue,
    setValue,
    debounce,
    monospace: true,
    rows: 8
  });
}

// Create entries for Script Task
function ScriptTaskEntries(props: { element: BpmnElement }): PropertyEntry[] {
  const { element } = props;

  if (!isScriptTask(element)) {
    return [];
  }

  return [
    {
      id: 'scriptFormat',
      component: ScriptFormat,
      isEdited: (element: BpmnElement) => !!getBusinessObject(element)?.scriptFormat
    },
    {
      id: 'script',
      component: ScriptContent,
      isEdited: (element: BpmnElement) => !!getBusinessObject(element)?.script
    }
  ];
}

// ============================================================================
// Properties Provider Class
// ============================================================================

export default class ScriptTaskPropertiesProvider {
  static $inject = ['propertiesPanel'];

  constructor(propertiesPanel: PropertiesPanel) {
    propertiesPanel.registerProvider(500, this);
  }

  getGroups(element: BpmnElement) {
    return (groups: PropertiesGroup[]) => {
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
