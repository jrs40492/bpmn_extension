/**
 * REST Task Properties Provider
 * Adds custom REST properties to the properties panel
 */

// Helper to get REST config from element
function getRestConfig(element: any): any {
  const bo = element?.businessObject;
  if (!bo) return null;

  const extensionElements = bo.extensionElements || bo.get?.('extensionElements');
  if (!extensionElements) return null;

  const values = extensionElements.values || extensionElements.get?.('values') || [];
  return values.find((ext: any) => ext.$type === 'rest:RestTaskConfig');
}

// Helper to check if element is a REST task
function isRestTask(element: any): boolean {
  if (!element?.businessObject) return false;
  const bo = element.businessObject;
  if (bo.$type !== 'bpmn:ServiceTask') return false;
  return getRestConfig(element) !== null;
}

// Helper to get or create REST config
function getOrCreateRestConfig(element: any, moddle: any, modeling: any): any {
  let restConfig = getRestConfig(element);

  if (!restConfig) {
    const bo = element.businessObject;

    // Create REST config
    restConfig = moddle.create('rest:RestTaskConfig', {
      url: '',
      method: 'GET',
      headers: '{"Content-Type": "application/json"}',
      body: '',
      responseVariable: 'response',
      timeout: 30000,
      retryCount: 0
    });

    // Get or create extension elements
    let extensionElements = bo.extensionElements;
    if (!extensionElements) {
      extensionElements = moddle.create('bpmn:ExtensionElements', { values: [] });
      modeling.updateProperties(element, { extensionElements });
    }

    // Add REST config to extension elements
    restConfig.$parent = extensionElements;
    extensionElements.values = extensionElements.values || [];
    extensionElements.values.push(restConfig);
  }

  return restConfig;
}

// Create property entry components
function createUrlEntry(element: any, injector: any) {
  const modeling = injector.get('modeling');
  const restConfig = getRestConfig(element);
  if (!restConfig) return null;

  return {
    id: 'rest-url',
    element,
    component: (props: any) => {
      const { element: el } = props;
      const config = getRestConfig(el);

      return {
        type: 'textField',
        label: 'URL',
        description: 'The REST API endpoint URL',
        getValue: () => config?.url || '',
        setValue: (value: string) => {
          if (config) {
            config.url = value;
            modeling.updateProperties(el, {});
          }
        }
      };
    }
  };
}

// REST Properties Group
function RestPropertiesGroup(element: any, injector: any) {
  if (!isRestTask(element)) {
    return null;
  }

  const modeling = injector.get('modeling');
  const restConfig = getRestConfig(element);

  if (!restConfig) return null;

  return {
    id: 'rest-configuration',
    label: 'REST API Configuration',
    entries: [
      {
        id: 'rest-url',
        element,
        label: 'URL',
        description: 'REST API endpoint URL',
        component: createTextInput('url', restConfig, modeling, element)
      },
      {
        id: 'rest-method',
        element,
        label: 'HTTP Method',
        component: createSelectInput('method', restConfig, modeling, element, [
          { value: 'GET', label: 'GET' },
          { value: 'POST', label: 'POST' },
          { value: 'PUT', label: 'PUT' },
          { value: 'PATCH', label: 'PATCH' },
          { value: 'DELETE', label: 'DELETE' }
        ])
      },
      {
        id: 'rest-headers',
        element,
        label: 'Headers (JSON)',
        description: 'HTTP headers as JSON',
        component: createTextAreaInput('headers', restConfig, modeling, element)
      },
      {
        id: 'rest-body',
        element,
        label: 'Request Body',
        description: 'Request body for POST/PUT/PATCH',
        component: createTextAreaInput('body', restConfig, modeling, element)
      },
      {
        id: 'rest-response-variable',
        element,
        label: 'Response Variable',
        description: 'Variable to store response',
        component: createTextInput('responseVariable', restConfig, modeling, element)
      },
      {
        id: 'rest-timeout',
        element,
        label: 'Timeout (ms)',
        component: createTextInput('timeout', restConfig, modeling, element)
      }
    ]
  };
}

function createTextInput(property: string, config: any, modeling: any, element: any) {
  return function TextInput(props: any) {
    const html = (window as any).html;
    if (!html) {
      // Fallback for when htm is not available
      return null;
    }

    const value = config[property] || '';

    const onChange = (event: any) => {
      config[property] = event.target.value;
      modeling.updateProperties(element, {});
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

function createSelectInput(property: string, config: any, modeling: any, element: any, options: Array<{value: string, label: string}>) {
  return function SelectInput(props: any) {
    const html = (window as any).html;
    if (!html) return null;

    const value = config[property] || options[0].value;

    const onChange = (event: any) => {
      config[property] = event.target.value;
      modeling.updateProperties(element, {});
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

function createTextAreaInput(property: string, config: any, modeling: any, element: any) {
  return function TextAreaInput(props: any) {
    const html = (window as any).html;
    if (!html) return null;

    const value = config[property] || '';

    const onChange = (event: any) => {
      config[property] = event.target.value;
      modeling.updateProperties(element, {});
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
