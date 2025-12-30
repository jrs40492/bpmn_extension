/**
 * REST Task Properties Provider
 * Uses STANDARD BPMN data input/output associations - no custom extensions
 */

import {
  isRestTask,
  getRestConfig,
  updateRestParam,
  REST_PARAMS,
  getResultVariableName,
  getAvailableProcessVariables,
  updateResultVariable
} from './palette-provider';

// REST Properties Group
function RestPropertiesGroup(element: any, injector: any) {
  if (!isRestTask(element)) {
    return null;
  }

  const modeling = injector.get('modeling');
  const bpmnFactory = injector.get('bpmnFactory');
  const config = getRestConfig(element);

  if (!config) return null;

  return {
    id: 'rest-configuration',
    label: 'REST API Configuration',
    entries: [
      {
        id: 'rest-url',
        element,
        label: 'URL',
        description: 'REST API endpoint URL',
        component: createTextInput('Url', config, modeling, element)
      },
      {
        id: 'rest-method',
        element,
        label: 'HTTP Method',
        component: createSelectInput('Method', config, modeling, element, [
          { value: 'GET', label: 'GET' },
          { value: 'POST', label: 'POST' },
          { value: 'PUT', label: 'PUT' },
          { value: 'PATCH', label: 'PATCH' },
          { value: 'DELETE', label: 'DELETE' }
        ])
      },
      {
        id: 'rest-content-type',
        element,
        label: 'Content-Type',
        component: createSelectInput('ContentType', config, modeling, element, [
          { value: 'application/json', label: 'application/json' },
          { value: 'application/xml', label: 'application/xml' },
          { value: 'text/plain', label: 'text/plain' }
        ])
      },
      {
        id: 'rest-content',
        element,
        label: 'Request Body',
        description: 'Request body for POST/PUT/PATCH',
        component: createTextAreaInput('Content', config, modeling, element)
      },
      {
        id: 'rest-timeout',
        element,
        label: 'Timeout (ms)',
        component: createTextInput('ReadTimeout', config, modeling, element)
      },
      {
        id: 'rest-output-variable',
        element,
        label: 'Output Variable',
        description: 'Process variable to store the REST response',
        component: createOutputVariableSelect(element, modeling, bpmnFactory)
      }
    ]
  };
}

function createTextInput(paramName: string, config: Record<string, string>, modeling: any, element: any) {
  return function TextInput(props: any) {
    const html = (window as any).html;
    if (!html) {
      return null;
    }

    const value = config[paramName] || '';

    const onChange = (event: any) => {
      updateRestParam(element, paramName, event.target.value, modeling);
      config[paramName] = event.target.value;
    };

    return html`
      <input
        type="text"
        class="bio-properties-panel-input"
        value=${value}
        onInput=${onChange}
      />
    `;
  };
}

function createSelectInput(paramName: string, config: Record<string, string>, modeling: any, element: any, options: Array<{value: string, label: string}>) {
  return function SelectInput(props: any) {
    const html = (window as any).html;
    if (!html) return null;

    const value = config[paramName] || options[0].value;

    const onChange = (event: any) => {
      updateRestParam(element, paramName, event.target.value, modeling);
      config[paramName] = event.target.value;
    };

    return html`
      <select
        class="bio-properties-panel-input"
        value=${value}
        onChange=${onChange}
      >
        ${options.map(opt => html`<option value=${opt.value}>${opt.label}</option>`)}
      </select>
    `;
  };
}

function createTextAreaInput(paramName: string, config: Record<string, string>, modeling: any, element: any) {
  return function TextAreaInput(props: any) {
    const html = (window as any).html;
    if (!html) return null;

    const value = config[paramName] || '';

    const onChange = (event: any) => {
      updateRestParam(element, paramName, event.target.value, modeling);
      config[paramName] = event.target.value;
    };

    return html`
      <textarea
        class="bio-properties-panel-input"
        rows="4"
        onInput=${onChange}
      >${value}</textarea>
    `;
  };
}

function createOutputVariableSelect(element: any, modeling: any, bpmnFactory: any) {
  return function OutputVariableSelect(props: any) {
    const html = (window as any).html;
    if (!html) return null;

    // Get current result variable
    const currentVariable = getResultVariableName(element) || 'restResult';

    // Get available process variables
    const availableVariables = getAvailableProcessVariables(element);

    // Build options list - include current value even if not in list
    const options: Array<{ value: string; label: string }> = [];

    // Add "Create new variable" option
    options.push({ value: '__new__', label: '-- Create New Variable --' });

    // Add existing variables
    for (const v of availableVariables) {
      options.push({ value: v.name, label: v.name });
    }

    // If current variable not in list, add it
    if (currentVariable && !availableVariables.find(v => v.name === currentVariable)) {
      options.push({ value: currentVariable, label: `${currentVariable} (current)` });
    }

    const onChange = (event: any) => {
      const newValue = event.target.value;

      if (newValue === '__new__') {
        // Prompt for new variable name
        const newVarName = prompt('Enter new variable name:', 'responseData');
        if (newVarName && newVarName.trim()) {
          updateResultVariable(element, newVarName.trim(), modeling, bpmnFactory);
        }
      } else if (newValue) {
        updateResultVariable(element, newValue, modeling, bpmnFactory);
      }
    };

    return html`
      <select
        class="bio-properties-panel-input"
        value=${currentVariable}
        onChange=${onChange}
      >
        ${options.map(opt => html`
          <option value=${opt.value} selected=${opt.value === currentVariable}>
            ${opt.label}
          </option>
        `)}
      </select>
    `;
  };
}

// Provider class
export default class RestTaskPropertiesProvider {
  static $inject = ['propertiesPanel', 'injector'];

  private injector: any;

  constructor(propertiesPanel: any, injector: any) {
    this.injector = injector;
    propertiesPanel.registerProvider(500, this);
  }

  getGroups(element: any) {
    return (groups: any[]) => {
      const restGroup = RestPropertiesGroup(element, this.injector);
      if (restGroup) {
        groups.push(restGroup);
      }
      return groups;
    };
  }
}
