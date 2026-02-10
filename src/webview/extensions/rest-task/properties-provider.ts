/**
 * REST Task Properties Provider
 * Uses STANDARD BPMN data input/output associations - no custom extensions
 */

// @ts-expect-error - no type definitions available
import { TextFieldEntry, TextAreaEntry, SelectEntry } from '@bpmn-io/properties-panel';
// @ts-expect-error - no type definitions available
import { useService } from 'bpmn-js-properties-panel';

import {
  isRestTask,
  getRestConfig,
  updateRestParam,
  getResultVariableName,
  getAvailableProcessVariables,
  updateResultVariable,
  updateResultOutputType,
  updateResultVariableType
} from './palette-provider';

// ============================================================================
// Type Definitions
// ============================================================================

interface BpmnElement {
  businessObject?: any;
}

interface CommandStack {
  execute(command: string, context: Record<string, unknown>): void;
}

interface Modeling {
  updateProperties(element: any, props: Record<string, unknown>): void;
}

interface BpmnFactory {
  create(type: string, attrs?: Record<string, unknown>): any;
}

interface PropertyEntry {
  id: string;
  component: (props: { element: BpmnElement; id: string }) => unknown;
  isEdited?: (element: BpmnElement) => boolean;
}

interface PropertiesGroup {
  id: string;
  label: string;
  entries: PropertyEntry[];
}

interface PropertiesPanel {
  registerProvider(priority: number, provider: unknown): void;
}

// ============================================================================
// Property Panel Components
// ============================================================================

function UrlEntry(props: { element: BpmnElement; id: string }) {
  const { element, id } = props;
  const modeling = useService('modeling') as Modeling;
  const bpmnFactory = useService('bpmnFactory') as BpmnFactory;
  const translate = useService('translate') as (text: string) => string;
  const debounce = useService('debounceInput') as <T>(fn: T) => T;

  const getValue = () => {
    const config = getRestConfig(element);
    return config?.['Url'] || '';
  };

  const setValue = (value: string) => {
    updateRestParam(element, 'Url', value, modeling, bpmnFactory);
  };

  return TextFieldEntry({
    id,
    element,
    label: translate('URL'),
    getValue,
    setValue,
    debounce
  });
}

function MethodEntry(props: { element: BpmnElement; id: string }) {
  const { element, id } = props;
  const modeling = useService('modeling') as Modeling;
  const bpmnFactory = useService('bpmnFactory') as BpmnFactory;
  const translate = useService('translate') as (text: string) => string;

  const getValue = () => {
    const config = getRestConfig(element);
    return config?.['Method'] || 'GET';
  };

  const setValue = (value: string) => {
    updateRestParam(element, 'Method', value, modeling, bpmnFactory);
  };

  const getOptions = () => [
    { value: 'GET', label: 'GET' },
    { value: 'POST', label: 'POST' },
    { value: 'PUT', label: 'PUT' },
    { value: 'PATCH', label: 'PATCH' },
    { value: 'DELETE', label: 'DELETE' },
    { value: 'HEAD', label: 'HEAD' },
    { value: 'OPTIONS', label: 'OPTIONS' }
  ];

  return SelectEntry({
    id,
    element,
    label: translate('HTTP Method'),
    getValue,
    setValue,
    getOptions
  });
}

function ContentTypeEntry(props: { element: BpmnElement; id: string }) {
  const { element, id } = props;
  const modeling = useService('modeling') as Modeling;
  const bpmnFactory = useService('bpmnFactory') as BpmnFactory;
  const translate = useService('translate') as (text: string) => string;

  const getValue = () => {
    const config = getRestConfig(element);
    return config?.['ContentType'] || 'application/json';
  };

  const setValue = (value: string) => {
    updateRestParam(element, 'ContentType', value, modeling, bpmnFactory);
  };

  const getOptions = () => [
    { value: 'application/json', label: 'application/json' },
    { value: 'application/xml', label: 'application/xml' },
    { value: 'application/x-www-form-urlencoded', label: 'application/x-www-form-urlencoded' },
    { value: 'text/plain', label: 'text/plain' }
  ];

  return SelectEntry({
    id,
    element,
    label: translate('Content-Type'),
    getValue,
    setValue,
    getOptions
  });
}

function AcceptHeaderEntry(props: { element: BpmnElement; id: string }) {
  const { element, id } = props;
  const modeling = useService('modeling') as Modeling;
  const bpmnFactory = useService('bpmnFactory') as BpmnFactory;
  const translate = useService('translate') as (text: string) => string;

  const getValue = () => {
    const config = getRestConfig(element);
    return config?.['AcceptHeader'] || 'application/json';
  };

  const setValue = (value: string) => {
    updateRestParam(element, 'AcceptHeader', value, modeling, bpmnFactory);
  };

  const getOptions = () => [
    { value: 'application/json', label: 'application/json' },
    { value: 'application/xml', label: 'application/xml' },
    { value: 'text/plain', label: 'text/plain' },
    { value: '*/*', label: '*/* (any)' }
  ];

  return SelectEntry({
    id,
    element,
    label: translate('Accept Header'),
    getValue,
    setValue,
    getOptions
  });
}

function RequestBodyEntry(props: { element: BpmnElement; id: string }) {
  const { element, id } = props;
  const modeling = useService('modeling') as Modeling;
  const bpmnFactory = useService('bpmnFactory') as BpmnFactory;
  const translate = useService('translate') as (text: string) => string;
  const debounce = useService('debounceInput') as <T>(fn: T) => T;

  const getValue = () => {
    const config = getRestConfig(element);
    return config?.['Content'] || '';
  };

  const setValue = (value: string) => {
    updateRestParam(element, 'Content', value, modeling, bpmnFactory);
  };

  return TextAreaEntry({
    id,
    element,
    label: translate('Request Body'),
    description: translate('Request body for POST/PUT/PATCH'),
    getValue,
    setValue,
    debounce,
    rows: 4
  });
}

function ResponseTypeEntry(props: { element: BpmnElement; id: string }) {
  const { element, id } = props;
  const modeling = useService('modeling') as Modeling;
  const bpmnFactory = useService('bpmnFactory') as BpmnFactory;
  const translate = useService('translate') as (text: string) => string;

  const getValue = () => {
    const config = getRestConfig(element);
    return config?.['ResultClass'] || '';
  };

  const setValue = (value: string) => {
    updateRestParam(element, 'ResultClass', value, modeling, bpmnFactory);
    updateResultOutputType(element, value);
    updateResultVariableType(element, value, bpmnFactory);
  };

  const getOptions = () => [
    { value: '', label: translate('String (raw response)') },
    { value: 'java.util.Map', label: translate('Map (JSON object)') },
    { value: 'java.util.List', label: translate('List (JSON array)') },
    { value: 'com.fasterxml.jackson.databind.JsonNode', label: translate('JsonNode (generic JSON)') }
  ];

  return SelectEntry({
    id,
    element,
    label: translate('Response Type'),
    getValue,
    setValue,
    getOptions
  });
}

function TimeoutEntry(props: { element: BpmnElement; id: string }) {
  const { element, id } = props;
  const modeling = useService('modeling') as Modeling;
  const bpmnFactory = useService('bpmnFactory') as BpmnFactory;
  const translate = useService('translate') as (text: string) => string;
  const debounce = useService('debounceInput') as <T>(fn: T) => T;

  const getValue = () => {
    const config = getRestConfig(element);
    return config?.['ReadTimeout'] || '30000';
  };

  const setValue = (value: string) => {
    updateRestParam(element, 'ReadTimeout', value, modeling, bpmnFactory);
    updateRestParam(element, 'ConnectTimeout', value, modeling, bpmnFactory);
  };

  return TextFieldEntry({
    id,
    element,
    label: translate('Timeout (ms)'),
    getValue,
    setValue,
    debounce
  });
}

function OutputVariableEntry(props: { element: BpmnElement; id: string }) {
  const { element, id } = props;
  const modeling = useService('modeling') as Modeling;
  const bpmnFactory = useService('bpmnFactory') as BpmnFactory;
  const translate = useService('translate') as (text: string) => string;

  const getValue = () => {
    return getResultVariableName(element) || 'restResult';
  };

  const setValue = (value: string) => {
    if (value && value !== '__new__') {
      updateResultVariable(element, value, modeling, bpmnFactory);
    }
  };

  const getOptions = () => {
    const currentVariable = getResultVariableName(element) || 'restResult';
    const availableVariables = getAvailableProcessVariables(element);

    const options: Array<{ value: string; label: string }> = [];

    // Add existing variables
    for (const v of availableVariables) {
      options.push({ value: v.name, label: v.name });
    }

    // If current variable not in list, add it
    if (currentVariable && !availableVariables.find(v => v.name === currentVariable)) {
      options.push({ value: currentVariable, label: `${currentVariable} (current)` });
    }

    return options;
  };

  return SelectEntry({
    id,
    element,
    label: translate('Output Variable'),
    getValue,
    setValue,
    getOptions
  });
}

// Create entries for REST Task
function RestTaskEntries(props: { element: BpmnElement }): PropertyEntry[] {
  const { element } = props;

  if (!isRestTask(element)) {
    return [];
  }

  return [
    {
      id: 'rest-url',
      component: UrlEntry,
      isEdited: () => {
        const config = getRestConfig(element);
        return !!config?.['Url'];
      }
    },
    {
      id: 'rest-method',
      component: MethodEntry,
      isEdited: () => {
        const config = getRestConfig(element);
        return !!config?.['Method'] && config['Method'] !== 'GET';
      }
    },
    {
      id: 'rest-content-type',
      component: ContentTypeEntry,
      isEdited: () => {
        const config = getRestConfig(element);
        return !!config?.['ContentType'] && config['ContentType'] !== 'application/json';
      }
    },
    {
      id: 'rest-accept-header',
      component: AcceptHeaderEntry,
      isEdited: () => {
        const config = getRestConfig(element);
        return !!config?.['AcceptHeader'] && config['AcceptHeader'] !== 'application/json';
      }
    },
    {
      id: 'rest-content',
      component: RequestBodyEntry,
      isEdited: () => {
        const config = getRestConfig(element);
        return !!config?.['Content'];
      }
    },
    {
      id: 'rest-result-class',
      component: ResponseTypeEntry,
      isEdited: () => {
        const config = getRestConfig(element);
        return !!config?.['ResultClass'];
      }
    },
    {
      id: 'rest-timeout',
      component: TimeoutEntry,
      isEdited: () => {
        const config = getRestConfig(element);
        return !!config?.['ReadTimeout'] && config['ReadTimeout'] !== '30000';
      }
    },
    {
      id: 'rest-output-variable',
      component: OutputVariableEntry,
      isEdited: () => {
        const varName = getResultVariableName(element);
        return !!varName && varName !== 'restResult';
      }
    }
  ];
}

// ============================================================================
// Properties Provider Class
// ============================================================================

export default class RestTaskPropertiesProvider {
  static $inject = ['propertiesPanel'];

  constructor(propertiesPanel: PropertiesPanel) {
    propertiesPanel.registerProvider(500, this);
  }

  getGroups(element: BpmnElement) {
    return (groups: PropertiesGroup[]) => {
      if (!isRestTask(element)) {
        return groups;
      }

      // Add REST Configuration group
      groups.push({
        id: 'rest-configuration',
        label: 'REST API Configuration',
        entries: RestTaskEntries({ element })
      });

      return groups;
    };
  }
}
