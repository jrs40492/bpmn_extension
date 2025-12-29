/**
 * Custom Element Extensions
 * Allow users to define and manage custom BPMN element extensions
 */

export interface CustomExtension {
  id: string;
  name: string;
  prefix: string;
  uri: string;
  description: string;
  properties: ExtensionProperty[];
  appliesTo: string[];  // BPMN element types this extension applies to
  enabled: boolean;
}

export interface ExtensionProperty {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'enum';
  defaultValue?: string | number | boolean;
  enumValues?: string[];
  description?: string;
  required?: boolean;
}

// Built-in extensions
const builtInExtensions: CustomExtension[] = [
  {
    id: 'rest-task',
    name: 'REST Task',
    prefix: 'rest',
    uri: 'http://bamoe.io/schema/rest',
    description: 'REST API call configuration for service tasks',
    appliesTo: ['bpmn:ServiceTask'],
    enabled: true,
    properties: [
      { name: 'url', type: 'string', description: 'REST endpoint URL', required: true },
      { name: 'method', type: 'enum', enumValues: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], defaultValue: 'GET' },
      { name: 'headers', type: 'string', description: 'JSON headers' },
      { name: 'body', type: 'string', description: 'Request body' },
      { name: 'responseVariable', type: 'string', defaultValue: 'response' },
      { name: 'timeout', type: 'number', defaultValue: 30000 }
    ]
  },
  {
    id: 'kafka-task',
    name: 'Kafka Task',
    prefix: 'kafka',
    uri: 'http://bamoe.io/schema/kafka',
    description: 'Apache Kafka producer/consumer configuration for messaging tasks',
    appliesTo: ['bpmn:SendTask', 'bpmn:ReceiveTask', 'bpmn:ServiceTask'],
    enabled: true,
    properties: [
      { name: 'topic', type: 'string', description: 'Kafka topic name', required: true },
      { name: 'bootstrapServers', type: 'string', description: 'Kafka broker addresses', defaultValue: 'localhost:9092' },
      { name: 'operation', type: 'enum', enumValues: ['publish', 'consume'], defaultValue: 'publish' },
      { name: 'keyExpression', type: 'string', description: 'Message key expression' },
      { name: 'messageExpression', type: 'string', description: 'Message value expression' },
      { name: 'groupId', type: 'string', description: 'Consumer group ID' },
      { name: 'acks', type: 'enum', enumValues: ['all', '1', '0'], defaultValue: 'all' },
      { name: 'retries', type: 'number', defaultValue: 3 },
      { name: 'timeout', type: 'number', defaultValue: 30000 },
      { name: 'responseVariable', type: 'string', defaultValue: 'kafkaResponse' }
    ]
  },
  {
    id: 'retry-config',
    name: 'Retry Configuration',
    prefix: 'retry',
    uri: 'http://bamoe.io/schema/retry',
    description: 'Automatic retry configuration for tasks',
    appliesTo: ['bpmn:ServiceTask', 'bpmn:ScriptTask', 'bpmn:SendTask'],
    enabled: false,
    properties: [
      { name: 'maxRetries', type: 'number', defaultValue: 3, description: 'Maximum retry attempts' },
      { name: 'retryDelay', type: 'number', defaultValue: 1000, description: 'Delay between retries (ms)' },
      { name: 'backoffMultiplier', type: 'number', defaultValue: 2, description: 'Exponential backoff multiplier' }
    ]
  },
  {
    id: 'notification',
    name: 'Notification',
    prefix: 'notify',
    uri: 'http://bamoe.io/schema/notification',
    description: 'Send notifications on task completion',
    appliesTo: ['bpmn:Task', 'bpmn:UserTask', 'bpmn:ServiceTask', 'bpmn:EndEvent'],
    enabled: false,
    properties: [
      { name: 'channel', type: 'enum', enumValues: ['email', 'slack', 'teams', 'webhook'], defaultValue: 'email' },
      { name: 'recipients', type: 'string', description: 'Comma-separated list of recipients' },
      { name: 'template', type: 'string', description: 'Notification template name' },
      { name: 'onSuccess', type: 'boolean', defaultValue: true },
      { name: 'onFailure', type: 'boolean', defaultValue: true }
    ]
  },
  {
    id: 'logging',
    name: 'Logging',
    prefix: 'log',
    uri: 'http://bamoe.io/schema/logging',
    description: 'Custom logging configuration',
    appliesTo: ['bpmn:Task', 'bpmn:ServiceTask', 'bpmn:ScriptTask', 'bpmn:Gateway'],
    enabled: false,
    properties: [
      { name: 'level', type: 'enum', enumValues: ['debug', 'info', 'warn', 'error'], defaultValue: 'info' },
      { name: 'message', type: 'string', description: 'Log message template' },
      { name: 'includeVariables', type: 'boolean', defaultValue: false }
    ]
  }
];

// User-defined extensions storage
let customExtensions: CustomExtension[] = [];

export function initExtensionsPanel(
  onExtensionToggle?: (extension: CustomExtension, enabled: boolean) => void
): {
  show: () => void;
  hide: () => void;
  getExtensions: () => CustomExtension[];
  addExtension: (ext: CustomExtension) => void;
  removeExtension: (id: string) => void;
  toggleExtension: (id: string, enabled: boolean) => void;
} {
  const panel = createExtensionsPanelHTML();
  document.body.appendChild(panel);

  const closeButton = panel.querySelector('.extensions-panel-close') as HTMLButtonElement;
  const builtInList = panel.querySelector('.builtin-extensions-list') as HTMLDivElement;
  const customList = panel.querySelector('.custom-extensions-list') as HTMLDivElement;
  const addBtn = panel.querySelector('#add-extension-btn') as HTMLButtonElement;
  const addForm = panel.querySelector('.add-extension-form') as HTMLDivElement;

  closeButton.addEventListener('click', () => {
    panel.classList.remove('visible');
  });

  addBtn.addEventListener('click', () => {
    addForm.classList.toggle('visible');
  });

  // Render extensions
  renderExtensions();

  function renderExtensions() {
    // Built-in extensions
    builtInList.innerHTML = builtInExtensions.map(ext => renderExtensionItem(ext, true)).join('');

    // Custom extensions
    if (customExtensions.length === 0) {
      customList.innerHTML = '<div class="extensions-empty">No custom extensions defined</div>';
    } else {
      customList.innerHTML = customExtensions.map(ext => renderExtensionItem(ext, false)).join('');
    }

    // Add event handlers
    panel.querySelectorAll('.extension-toggle').forEach(toggle => {
      toggle.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const extId = target.dataset.extensionId;
        const enabled = target.checked;

        // Find and update extension
        const builtIn = builtInExtensions.find(ex => ex.id === extId);
        if (builtIn) {
          builtIn.enabled = enabled;
        } else {
          const custom = customExtensions.find(ex => ex.id === extId);
          if (custom) {
            custom.enabled = enabled;
          }
        }

        const ext = builtIn || customExtensions.find(ex => ex.id === extId);
        if (ext) {
          onExtensionToggle?.(ext, enabled);
        }
      });
    });

    panel.querySelectorAll('.extension-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const extId = (e.target as HTMLElement).dataset.extensionId;
        if (extId) {
          customExtensions = customExtensions.filter(ex => ex.id !== extId);
          renderExtensions();
        }
      });
    });
  }

  // Handle add extension form
  const saveBtn = panel.querySelector('#save-extension-btn') as HTMLButtonElement;
  saveBtn?.addEventListener('click', () => {
    const nameInput = panel.querySelector('#ext-name') as HTMLInputElement;
    const prefixInput = panel.querySelector('#ext-prefix') as HTMLInputElement;
    const uriInput = panel.querySelector('#ext-uri') as HTMLInputElement;
    const descInput = panel.querySelector('#ext-description') as HTMLInputElement;
    const appliesToInput = panel.querySelector('#ext-applies-to') as HTMLInputElement;

    if (nameInput.value && prefixInput.value && uriInput.value) {
      const newExt: CustomExtension = {
        id: 'custom_' + Date.now(),
        name: nameInput.value,
        prefix: prefixInput.value,
        uri: uriInput.value,
        description: descInput.value || '',
        appliesTo: appliesToInput.value.split(',').map(s => s.trim()).filter(Boolean),
        enabled: true,
        properties: []
      };

      customExtensions.push(newExt);
      renderExtensions();
      addForm.classList.remove('visible');

      // Clear form
      nameInput.value = '';
      prefixInput.value = '';
      uriInput.value = '';
      descInput.value = '';
      appliesToInput.value = '';
    }
  });

  function show() {
    panel.classList.add('visible');
  }

  function hide() {
    panel.classList.remove('visible');
  }

  return {
    show,
    hide,
    getExtensions: () => [...builtInExtensions, ...customExtensions],
    addExtension: (ext: CustomExtension) => {
      customExtensions.push(ext);
      renderExtensions();
    },
    removeExtension: (id: string) => {
      customExtensions = customExtensions.filter(ex => ex.id !== id);
      renderExtensions();
    },
    toggleExtension: (id: string, enabled: boolean) => {
      const ext = builtInExtensions.find(ex => ex.id === id) ||
                  customExtensions.find(ex => ex.id === id);
      if (ext) {
        ext.enabled = enabled;
        renderExtensions();
      }
    }
  };
}

function renderExtensionItem(ext: CustomExtension, isBuiltIn: boolean): string {
  return `
    <div class="extension-item ${ext.enabled ? 'enabled' : 'disabled'}">
      <div class="extension-header">
        <label class="extension-toggle-label">
          <input type="checkbox" class="extension-toggle"
                 data-extension-id="${ext.id}"
                 ${ext.enabled ? 'checked' : ''} />
          <span class="extension-name">${ext.name}</span>
        </label>
        ${!isBuiltIn ? `<button class="extension-delete" data-extension-id="${ext.id}" title="Delete">🗑️</button>` : ''}
      </div>
      <div class="extension-meta">
        <span class="extension-prefix">${ext.prefix}:</span>
        <span class="extension-uri">${ext.uri}</span>
      </div>
      <div class="extension-description">${ext.description}</div>
      <div class="extension-applies">
        <span class="applies-label">Applies to:</span>
        ${ext.appliesTo.map(t => `<span class="applies-tag">${t.replace('bpmn:', '')}</span>`).join('')}
      </div>
      ${ext.properties.length > 0 ? `
        <div class="extension-properties">
          <span class="props-label">Properties:</span>
          ${ext.properties.map(p => `<span class="prop-tag">${p.name}</span>`).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

function createExtensionsPanelHTML(): HTMLDivElement {
  const panel = document.createElement('div');
  panel.id = 'extensions-panel';
  panel.className = 'extensions-panel';

  panel.innerHTML = `
    <div class="extensions-panel-header">
      <span class="extensions-panel-icon">🧩</span>
      <span class="extensions-panel-title">BPMN Extensions</span>
      <button class="extensions-panel-close" title="Close">&times;</button>
    </div>
    <div class="extensions-panel-body">
      <div class="extensions-section">
        <div class="extensions-section-title">Built-in Extensions</div>
        <div class="builtin-extensions-list"></div>
      </div>

      <div class="extensions-section">
        <div class="extensions-section-header">
          <span class="extensions-section-title">Custom Extensions</span>
          <button id="add-extension-btn" class="extensions-add-btn">+ Add</button>
        </div>
        <div class="custom-extensions-list"></div>
      </div>

      <div class="add-extension-form">
        <div class="form-title">Add Custom Extension</div>
        <div class="form-field">
          <label>Name</label>
          <input type="text" id="ext-name" placeholder="My Extension" />
        </div>
        <div class="form-field">
          <label>Prefix</label>
          <input type="text" id="ext-prefix" placeholder="myext" />
        </div>
        <div class="form-field">
          <label>Namespace URI</label>
          <input type="text" id="ext-uri" placeholder="http://example.com/schema/myext" />
        </div>
        <div class="form-field">
          <label>Description</label>
          <input type="text" id="ext-description" placeholder="What does this extension do?" />
        </div>
        <div class="form-field">
          <label>Applies To (comma-separated)</label>
          <input type="text" id="ext-applies-to" placeholder="bpmn:ServiceTask, bpmn:UserTask" />
        </div>
        <button id="save-extension-btn" class="save-extension-btn">Save Extension</button>
      </div>
    </div>
  `;

  return panel;
}
