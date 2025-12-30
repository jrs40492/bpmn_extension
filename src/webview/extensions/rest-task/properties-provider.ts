/**
 * REST Task Properties Provider
 * Uses STANDARD BPMN data input/output associations - no custom extensions
 */

import { isRestTask, getRestConfig, updateRestParam, REST_PARAMS } from './palette-provider';

// REST Properties Group
function RestPropertiesGroup(element: any, injector: any) {
  if (!isRestTask(element)) {
    return null;
  }

  const modeling = injector.get('modeling');
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
