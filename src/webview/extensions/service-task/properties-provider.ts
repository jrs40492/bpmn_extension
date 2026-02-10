/**
 * Java Service Task Properties Provider
 * Adds serviceinterface and serviceoperation properties to the properties panel
 * for ServiceTasks with implementation="Java" or drools:serviceimplementation="Java"
 */

import { TextFieldEntry } from '@bpmn-io/properties-panel';
// @ts-expect-error - no type definitions available
import { useService } from 'bpmn-js-properties-panel';

// ============================================================================
// BPMN-JS Type Definitions (no official types available)
// ============================================================================

interface ModdleElement {
  $type: string;
  $attrs?: Record<string, string>;
  get(name: string): string | undefined;
  set(name: string, value: string | undefined): void;
}

interface ServiceTaskBusinessObject extends ModdleElement {
  implementation?: string;
  'drools:serviceimplementation'?: string;
  'drools:serviceinterface'?: string;
  'drools:serviceoperation'?: string;
}

interface BpmnElement {
  businessObject?: ServiceTaskBusinessObject;
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

function isJavaServiceTask(element: BpmnElement): boolean {
  const bo = element?.businessObject;
  if (!bo || bo.$type !== 'bpmn:ServiceTask') {
    return false;
  }
  return bo.implementation === 'Java' ||
    bo.get('drools:serviceimplementation') === 'Java';
}

function getBusinessObject(element: BpmnElement): ServiceTaskBusinessObject | undefined {
  return element?.businessObject;
}

// ============================================================================
// Property Panel Components
// ============================================================================

function JavaInterface(props: { element: BpmnElement; id: string }) {
  const { element, id } = props;
  const commandStack = useService('commandStack') as CommandStack;
  const translate = useService('translate') as (text: string) => string;
  const debounce = useService('debounceInput') as <T>(fn: T) => T;

  const businessObject = getBusinessObject(element);

  const getValue = () => {
    return businessObject?.get('drools:serviceinterface') || '';
  };

  const setValue = (value: string) => {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: businessObject,
      properties: {
        'drools:serviceinterface': value || undefined
      }
    });
  };

  return TextFieldEntry({
    id,
    element,
    label: translate('Java Interface'),
    description: translate('Fully qualified Java class name (e.g., com.example.MyService)'),
    getValue,
    setValue,
    debounce
  });
}

function Operation(props: { element: BpmnElement; id: string }) {
  const { element, id } = props;
  const commandStack = useService('commandStack') as CommandStack;
  const translate = useService('translate') as (text: string) => string;
  const debounce = useService('debounceInput') as <T>(fn: T) => T;

  const businessObject = getBusinessObject(element);

  const getValue = () => {
    return businessObject?.get('drools:serviceoperation') || '';
  };

  const setValue = (value: string) => {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: businessObject,
      properties: {
        'drools:serviceoperation': value || undefined
      }
    });
  };

  return TextFieldEntry({
    id,
    element,
    label: translate('Operation'),
    description: translate('Method name to invoke on the service interface'),
    getValue,
    setValue,
    debounce
  });
}

function JavaServiceTaskEntries(props: { element: BpmnElement }): PropertyEntry[] {
  const { element } = props;

  if (!isJavaServiceTask(element)) {
    return [];
  }

  return [
    {
      id: 'serviceinterface',
      component: JavaInterface,
      isEdited: (element: BpmnElement) => !!getBusinessObject(element)?.get('drools:serviceinterface')
    },
    {
      id: 'serviceoperation',
      component: Operation,
      isEdited: (element: BpmnElement) => !!getBusinessObject(element)?.get('drools:serviceoperation')
    }
  ];
}

// ============================================================================
// Properties Provider Class
// ============================================================================

export default class JavaServiceTaskPropertiesProvider {
  static $inject = ['propertiesPanel'];

  constructor(propertiesPanel: PropertiesPanel) {
    propertiesPanel.registerProvider(500, this);
  }

  getGroups(element: BpmnElement) {
    return (groups: PropertiesGroup[]) => {
      if (!isJavaServiceTask(element)) {
        return groups;
      }

      groups.push({
        id: 'java-service-configuration',
        label: 'Java Service Configuration',
        entries: JavaServiceTaskEntries({ element })
      });

      return groups;
    };
  }
}
