/**
 * REST Task Configuration Panel
 * Uses STANDARD BPMN data input/output associations - no custom extensions
 */

import { isRestTask, getRestConfig, updateRestParam, REST_PARAMS } from './palette-provider';

interface Modeling {
  updateProperties: (element: any, props: Record<string, unknown>) => void;
}

interface EventBus {
  on: (event: string, callback: (event: unknown) => void) => void;
  fire: (event: string, data?: unknown) => void;
}

interface BpmnFactory {
  create: (type: string, attrs?: Record<string, unknown>) => any;
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
        <small class="rest-hint">Use {variableName} for process variable substitution</small>
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
        <label for="rest-content-type">Content-Type</label>
        <select id="rest-content-type">
          <option value="application/json">application/json</option>
          <option value="application/xml">application/xml</option>
          <option value="application/x-www-form-urlencoded">application/x-www-form-urlencoded</option>
          <option value="text/plain">text/plain</option>
        </select>
      </div>
      <div class="rest-field">
        <label for="rest-accept-header">Accept Header</label>
        <select id="rest-accept-header">
          <option value="application/json">application/json</option>
          <option value="application/xml">application/xml</option>
          <option value="text/plain">text/plain</option>
          <option value="*/*">*/* (any)</option>
        </select>
      </div>
      <div class="rest-field">
        <label for="rest-content">Request Body</label>
        <textarea id="rest-content" rows="4" placeholder="Request body (for POST, PUT, PATCH)"></textarea>
      </div>
      <div class="rest-field">
        <label for="rest-result-class">Response Type</label>
        <select id="rest-result-class">
          <option value="">String (raw response)</option>
          <option value="java.util.Map">Map (JSON object)</option>
          <option value="java.util.List">List (JSON array)</option>
          <option value="com.fasterxml.jackson.databind.JsonNode">JsonNode (generic JSON)</option>
        </select>
        <small class="rest-hint">How to parse the response body</small>
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
export function initRestPanel(eventBus: EventBus, modeling: Modeling, bpmnFactory: BpmnFactory): void {
  let currentElement: any = null;
  let panel: HTMLDivElement | null = null;

  // Create panel
  panel = createRestPanelHTML();
  document.body.appendChild(panel);

  // Get input elements
  const urlInput = panel.querySelector('#rest-url') as HTMLInputElement;
  const methodSelect = panel.querySelector('#rest-method') as HTMLSelectElement;
  const contentTypeSelect = panel.querySelector('#rest-content-type') as HTMLSelectElement;
  const acceptHeaderSelect = panel.querySelector('#rest-accept-header') as HTMLSelectElement;
  const contentInput = panel.querySelector('#rest-content') as HTMLTextAreaElement;
  const resultClassSelect = panel.querySelector('#rest-result-class') as HTMLSelectElement;
  const timeoutInput = panel.querySelector('#rest-timeout') as HTMLInputElement;
  const closeButton = panel.querySelector('.rest-panel-close') as HTMLButtonElement;

  // Close button handler
  closeButton.addEventListener('click', () => {
    panel!.classList.remove('visible');
    currentElement = null;
  });

  // Helper to update param and trigger change event
  const updateAndNotify = (paramName: string, value: string) => {
    if (!currentElement) return;
    updateRestParam(currentElement, paramName, value, modeling, bpmnFactory);
    // Fire commandStack.changed to trigger save - this ensures changes persist
    eventBus.fire('commandStack.changed', {});
  };

  // Input handlers - update standard BPMN data input associations
  urlInput.addEventListener('input', () => {
    updateAndNotify('Url', urlInput.value);
  });

  methodSelect.addEventListener('change', () => {
    updateAndNotify('Method', methodSelect.value);
  });

  contentTypeSelect.addEventListener('change', () => {
    updateAndNotify('ContentType', contentTypeSelect.value);
  });

  acceptHeaderSelect.addEventListener('change', () => {
    updateAndNotify('AcceptHeader', acceptHeaderSelect.value);
  });

  contentInput.addEventListener('input', () => {
    updateAndNotify('Content', contentInput.value);
  });

  resultClassSelect.addEventListener('change', () => {
    updateAndNotify('ResultClass', resultClassSelect.value);
  });

  timeoutInput.addEventListener('input', () => {
    if (currentElement) {
      const timeout = timeoutInput.value || '30000';
      updateRestParam(currentElement, 'ReadTimeout', timeout, modeling, bpmnFactory);
      updateRestParam(currentElement, 'ConnectTimeout', timeout, modeling, bpmnFactory);
      eventBus.fire('commandStack.changed', {});
    }
  });

  // Listen for selection changes
  eventBus.on('selection.changed', (event: unknown) => {
    const selectionEvent = event as { newSelection?: any[] };
    const selection = selectionEvent.newSelection;

    if (selection && selection.length === 1) {
      const element = selection[0];

      if (isRestTask(element)) {
        currentElement = element;
        const config = getRestConfig(element);

        if (config) {
          // Populate fields from standard BPMN data associations
          urlInput.value = config['Url'] || '';
          methodSelect.value = config['Method'] || 'GET';
          contentTypeSelect.value = config['ContentType'] || 'application/json';
          acceptHeaderSelect.value = config['AcceptHeader'] || 'application/json';
          contentInput.value = config['Content'] || '';
          resultClassSelect.value = config['ResultClass'] || '';
          timeoutInput.value = config['ReadTimeout'] || '30000';

          // Show panel
          panel!.classList.add('visible');
        }
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
