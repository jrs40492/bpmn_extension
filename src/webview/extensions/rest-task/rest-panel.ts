/**
 * REST Task Configuration Panel
 * Uses STANDARD BPMN data input/output associations - no custom extensions
 */

import { isRestTask, getRestConfig, updateRestParam, updateResultOutputType, updateResultVariableType, getResultVariableName, getStatusCodeVariableName, getAvailableProcessVariables, updateResultVariable, updateStatusCodeVariable, REST_PARAMS } from './palette-provider';

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
      <div class="rest-field">
        <label for="rest-handle-errors">Handle Response Errors</label>
        <select id="rest-handle-errors">
          <option value="false">False (return error in Result)</option>
          <option value="true">True (throw exception on HTTP errors)</option>
        </select>
        <small class="rest-hint">Whether to throw an exception when HTTP status is an error (4xx/5xx)</small>
      </div>
      <div class="rest-field">
        <label for="rest-output-variable">Response Body Variable</label>
        <select id="rest-output-variable">
          <option value="">-- Select Variable --</option>
        </select>
        <small class="rest-hint">Process variable to store the response body</small>
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
  const outputVariableSelect = panel.querySelector('#rest-output-variable') as HTMLSelectElement;
  const handleErrorsSelect = panel.querySelector('#rest-handle-errors') as HTMLSelectElement;
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
    if (!currentElement) return;
    const resultClass = resultClassSelect.value;
    // Update the ResultClass input parameter
    updateRestParam(currentElement, 'ResultClass', resultClass, modeling, bpmnFactory);
    // Update the Result output's drools:dtype to match
    updateResultOutputType(currentElement, resultClass);
    // Update the process variable's type to match
    updateResultVariableType(currentElement, resultClass, bpmnFactory);
    // Trigger save
    eventBus.fire('commandStack.changed', {});
  });

  timeoutInput.addEventListener('input', () => {
    if (currentElement) {
      const timeout = timeoutInput.value || '30000';
      updateRestParam(currentElement, 'ReadTimeout', timeout, modeling, bpmnFactory);
      updateRestParam(currentElement, 'ConnectTimeout', timeout, modeling, bpmnFactory);
      eventBus.fire('commandStack.changed', {});
    }
  });

  handleErrorsSelect.addEventListener('change', () => {
    updateAndNotify('HandleResponseErrors', handleErrorsSelect.value);
  });

  outputVariableSelect.addEventListener('change', () => {
    if (!currentElement) return;
    const selectedValue = outputVariableSelect.value;

    if (selectedValue === '__new__') {
      // Prompt for new variable name
      const newVarName = prompt('Enter new variable name:', 'responseData');
      if (newVarName && newVarName.trim()) {
        updateResultVariable(currentElement, newVarName.trim(), modeling, bpmnFactory);
        // Add the new option and select it
        const newOption = document.createElement('option');
        newOption.value = newVarName.trim();
        newOption.textContent = newVarName.trim();
        outputVariableSelect.insertBefore(newOption, outputVariableSelect.lastElementChild);
        outputVariableSelect.value = newVarName.trim();
      } else {
        // Reset to current value if cancelled
        outputVariableSelect.value = getResultVariableName(currentElement) || '';
      }
    } else if (selectedValue) {
      updateResultVariable(currentElement, selectedValue, modeling, bpmnFactory);
    }
    eventBus.fire('commandStack.changed', {});
  });

  // Helper to populate output variable dropdown
  const populateOutputVariableSelect = (element: any) => {
    // Clear existing options
    outputVariableSelect.innerHTML = '';

    // Get current value
    const currentVariable = getResultVariableName(element) || '';

    // Get available variables
    const availableVariables = getAvailableProcessVariables(element);

    // Add placeholder option
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = '-- Select Variable --';
    outputVariableSelect.appendChild(placeholderOption);

    // Add existing variables
    for (const v of availableVariables) {
      const option = document.createElement('option');
      option.value = v.name;
      option.textContent = v.name;
      outputVariableSelect.appendChild(option);
    }

    // If current variable is not in the list, add it
    if (currentVariable && !availableVariables.find(v => v.name === currentVariable)) {
      const currentOption = document.createElement('option');
      currentOption.value = currentVariable;
      currentOption.textContent = `${currentVariable} (current)`;
      outputVariableSelect.appendChild(currentOption);
    }

    // Add "Create new" option
    const newOption = document.createElement('option');
    newOption.value = '__new__';
    newOption.textContent = '+ Create New Variable...';
    outputVariableSelect.appendChild(newOption);

    // Set current value
    outputVariableSelect.value = currentVariable;
  };

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
          handleErrorsSelect.value = config['HandleResponseErrors'] || 'false';

          // Populate output variable dropdowns
          populateOutputVariableSelect(element);

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
