/**
 * REST Task Configuration Panel
 * A simple custom panel for editing REST task properties
 */

interface RestConfig {
  url: string;
  method: string;
  headers: string;
  body: string;
  responseVariable: string;
  timeout: number;
}

interface BusinessObject {
  $type: string;
  extensionElements?: {
    values?: Array<{
      $type: string;
      url?: string;
      method?: string;
      headers?: string;
      body?: string;
      responseVariable?: string;
      timeout?: number;
      $parent?: unknown;
    }>;
    $parent?: unknown;
  };
}

interface Element {
  businessObject: BusinessObject;
}

interface Modeling {
  updateProperties: (element: Element, props: Record<string, unknown>) => void;
}

interface EventBus {
  on: (event: string, callback: (event: unknown) => void) => void;
}

// Get REST config from element
// Kogito uses bpmn:Task (not bpmn:ServiceTask) for work item handlers
function getRestConfig(element: Element | null): RestConfig | null {
  if (!element?.businessObject) return null;

  const bo = element.businessObject;
  // Support both bpmn:Task (Kogito-compatible) and bpmn:ServiceTask (legacy)
  if (bo.$type !== 'bpmn:Task' && bo.$type !== 'bpmn:ServiceTask') return null;

  const extensionElements = bo.extensionElements;
  if (!extensionElements?.values) return null;

  const restConfig = extensionElements.values.find(
    (ext) => ext.$type === 'rest:RestTaskConfig'
  );

  if (!restConfig) return null;

  return {
    url: restConfig.url || '',
    method: restConfig.method || 'GET',
    headers: restConfig.headers || '{}',
    body: restConfig.body || '',
    responseVariable: restConfig.responseVariable || 'response',
    timeout: restConfig.timeout || 30000
  };
}

// Update REST config on element
function updateRestConfig(element: Element, property: string, value: string | number, modeling: Modeling): void {
  const bo = element.businessObject;
  const extensionElements = bo.extensionElements;
  if (!extensionElements?.values) return;

  const restConfig = extensionElements.values.find(
    (ext) => ext.$type === 'rest:RestTaskConfig'
  );

  if (restConfig) {
    (restConfig as Record<string, unknown>)[property] = value;
    // Trigger update
    modeling.updateProperties(element, {});
  }
}

// Create the REST panel HTML
function createRestPanelHTML(): HTMLDivElement {
  const panel = document.createElement('div');
  panel.id = 'rest-config-panel';
  panel.className = 'rest-config-panel';
  panel.innerHTML = `
    <div class="rest-panel-header">
      <span class="rest-panel-icon">🔌</span>
      <span class="rest-panel-title">REST API Configuration</span>
      <button class="rest-panel-close" title="Close">&times;</button>
    </div>
    <div class="rest-panel-body">
      <div class="rest-field">
        <label for="rest-url">URL</label>
        <input type="text" id="rest-url" placeholder="https://api.example.com/endpoint" />
      </div>
      <div class="rest-field">
        <label for="rest-method">Method</label>
        <select id="rest-method">
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="PATCH">PATCH</option>
          <option value="DELETE">DELETE</option>
          <option value="HEAD">HEAD</option>
          <option value="OPTIONS">OPTIONS</option>
        </select>
      </div>
      <div class="rest-field">
        <label for="rest-headers">Headers (JSON)</label>
        <textarea id="rest-headers" rows="3" placeholder='{"Content-Type": "application/json"}'></textarea>
      </div>
      <div class="rest-field">
        <label for="rest-body">Request Body</label>
        <textarea id="rest-body" rows="4" placeholder="Request body (for POST, PUT, PATCH)"></textarea>
      </div>
      <div class="rest-field">
        <label for="rest-response-var">Response Variable</label>
        <input type="text" id="rest-response-var" placeholder="response" />
      </div>
      <div class="rest-field">
        <label for="rest-timeout">Timeout (ms)</label>
        <input type="number" id="rest-timeout" placeholder="30000" />
      </div>
    </div>
  `;
  return panel;
}

// Initialize REST panel
export function initRestPanel(eventBus: EventBus, modeling: Modeling): void {
  let currentElement: Element | null = null;
  let panel: HTMLDivElement | null = null;

  // Create panel
  panel = createRestPanelHTML();
  document.body.appendChild(panel);

  // Get input elements
  const urlInput = panel.querySelector('#rest-url') as HTMLInputElement;
  const methodSelect = panel.querySelector('#rest-method') as HTMLSelectElement;
  const headersInput = panel.querySelector('#rest-headers') as HTMLTextAreaElement;
  const bodyInput = panel.querySelector('#rest-body') as HTMLTextAreaElement;
  const responseVarInput = panel.querySelector('#rest-response-var') as HTMLInputElement;
  const timeoutInput = panel.querySelector('#rest-timeout') as HTMLInputElement;
  const closeButton = panel.querySelector('.rest-panel-close') as HTMLButtonElement;

  // Close button handler
  closeButton.addEventListener('click', () => {
    panel!.classList.remove('visible');
    currentElement = null;
  });

  // Input handlers
  urlInput.addEventListener('input', () => {
    if (currentElement) updateRestConfig(currentElement, 'url', urlInput.value, modeling);
  });

  methodSelect.addEventListener('change', () => {
    if (currentElement) updateRestConfig(currentElement, 'method', methodSelect.value, modeling);
  });

  headersInput.addEventListener('input', () => {
    if (currentElement) updateRestConfig(currentElement, 'headers', headersInput.value, modeling);
  });

  bodyInput.addEventListener('input', () => {
    if (currentElement) updateRestConfig(currentElement, 'body', bodyInput.value, modeling);
  });

  responseVarInput.addEventListener('input', () => {
    if (currentElement) updateRestConfig(currentElement, 'responseVariable', responseVarInput.value, modeling);
  });

  timeoutInput.addEventListener('input', () => {
    if (currentElement) updateRestConfig(currentElement, 'timeout', parseInt(timeoutInput.value, 10) || 30000, modeling);
  });

  // Listen for selection changes
  eventBus.on('selection.changed', (event: unknown) => {
    const selectionEvent = event as { newSelection?: Element[] };
    const selection = selectionEvent.newSelection;

    if (selection && selection.length === 1) {
      const element = selection[0];
      const config = getRestConfig(element);

      if (config) {
        currentElement = element;

        // Populate fields
        urlInput.value = config.url;
        methodSelect.value = config.method;
        headersInput.value = config.headers;
        bodyInput.value = config.body;
        responseVarInput.value = config.responseVariable;
        timeoutInput.value = String(config.timeout);

        // Show panel
        panel!.classList.add('visible');
      } else {
        panel!.classList.remove('visible');
        currentElement = null;
      }
    } else {
      panel!.classList.remove('visible');
      currentElement = null;
    }
  });
}
