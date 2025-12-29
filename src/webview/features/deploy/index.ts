/**
 * Workflow Engine Integration
 * Deploy BPMN diagrams to Camunda, Flowable, or other engines
 */

export interface EngineConfig {
  type: 'camunda7' | 'camunda8' | 'flowable' | 'custom';
  name: string;
  url: string;
  username?: string;
  password?: string;
  tenantId?: string;
}

export interface DeploymentResult {
  success: boolean;
  deploymentId?: string;
  message: string;
  details?: Record<string, unknown>;
}

// Default engine configurations
const defaultEngines: EngineConfig[] = [
  {
    type: 'camunda7',
    name: 'Camunda 7 (Local)',
    url: 'http://localhost:8080/engine-rest'
  },
  {
    type: 'camunda8',
    name: 'Camunda 8 (Local)',
    url: 'http://localhost:26500'
  },
  {
    type: 'flowable',
    name: 'Flowable (Local)',
    url: 'http://localhost:8080/flowable-rest'
  }
];

// Store configured engines
let engines: EngineConfig[] = [...defaultEngines];

export function initDeployPanel(
  getCurrentXml: () => Promise<string>,
  getFileName: () => string
): {
  show: () => void;
  hide: () => void;
  addEngine: (config: EngineConfig) => void;
  getEngines: () => EngineConfig[];
} {
  const panel = createDeployPanelHTML();
  document.body.appendChild(panel);

  const closeButton = panel.querySelector('.deploy-panel-close') as HTMLButtonElement;
  const engineSelect = panel.querySelector('#deploy-engine-select') as HTMLSelectElement;
  const deployButton = panel.querySelector('#deploy-btn') as HTMLButtonElement;
  const statusDiv = panel.querySelector('.deploy-status') as HTMLDivElement;
  const addEngineBtn = panel.querySelector('#add-engine-btn') as HTMLButtonElement;
  const engineForm = panel.querySelector('.engine-form') as HTMLDivElement;

  // Populate engine select
  function updateEngineSelect() {
    engineSelect.innerHTML = engines.map((e, i) =>
      `<option value="${i}">${e.name} (${e.type})</option>`
    ).join('');
  }
  updateEngineSelect();

  closeButton.addEventListener('click', () => {
    panel.classList.remove('visible');
  });

  addEngineBtn.addEventListener('click', () => {
    engineForm.classList.toggle('visible');
  });

  // Handle add engine form
  const saveEngineBtn = panel.querySelector('#save-engine-btn') as HTMLButtonElement;
  saveEngineBtn?.addEventListener('click', () => {
    const typeSelect = panel.querySelector('#engine-type') as HTMLSelectElement;
    const nameInput = panel.querySelector('#engine-name') as HTMLInputElement;
    const urlInput = panel.querySelector('#engine-url') as HTMLInputElement;
    const usernameInput = panel.querySelector('#engine-username') as HTMLInputElement;
    const passwordInput = panel.querySelector('#engine-password') as HTMLInputElement;

    if (nameInput.value && urlInput.value) {
      engines.push({
        type: typeSelect.value as EngineConfig['type'],
        name: nameInput.value,
        url: urlInput.value,
        username: usernameInput.value || undefined,
        password: passwordInput.value || undefined
      });
      updateEngineSelect();
      engineForm.classList.remove('visible');

      // Clear form
      nameInput.value = '';
      urlInput.value = '';
      usernameInput.value = '';
      passwordInput.value = '';
    }
  });

  deployButton.addEventListener('click', async () => {
    const selectedIndex = parseInt(engineSelect.value, 10);
    const engine = engines[selectedIndex];

    if (!engine) {
      showStatus('error', 'Please select an engine');
      return;
    }

    deployButton.disabled = true;
    deployButton.textContent = 'Deploying...';
    showStatus('info', `Deploying to ${engine.name}...`);

    try {
      const xml = await getCurrentXml();
      const fileName = getFileName() || 'diagram.bpmn';
      const result = await deployToEngine(engine, xml, fileName);

      if (result.success) {
        showStatus('success', result.message);
      } else {
        showStatus('error', result.message);
      }
    } catch (err) {
      showStatus('error', `Deployment failed: ${err}`);
    } finally {
      deployButton.disabled = false;
      deployButton.textContent = 'Deploy';
    }
  });

  function showStatus(type: 'success' | 'error' | 'info', message: string) {
    statusDiv.className = `deploy-status ${type}`;
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';
  }

  function show() {
    panel.classList.add('visible');
    statusDiv.style.display = 'none';
  }

  function hide() {
    panel.classList.remove('visible');
  }

  return {
    show,
    hide,
    addEngine: (config: EngineConfig) => {
      engines.push(config);
      updateEngineSelect();
    },
    getEngines: () => [...engines]
  };
}

async function deployToEngine(
  engine: EngineConfig,
  xml: string,
  fileName: string
): Promise<DeploymentResult> {
  const headers: Record<string, string> = {
    'Accept': 'application/json'
  };

  // Add basic auth if credentials provided
  if (engine.username && engine.password) {
    const credentials = btoa(`${engine.username}:${engine.password}`);
    headers['Authorization'] = `Basic ${credentials}`;
  }

  try {
    switch (engine.type) {
      case 'camunda7':
        return await deployCamunda7(engine, xml, fileName, headers);
      case 'camunda8':
        return await deployCamunda8(engine, xml, fileName, headers);
      case 'flowable':
        return await deployFlowable(engine, xml, fileName, headers);
      default:
        return await deployCustom(engine, xml, fileName, headers);
    }
  } catch (err) {
    return {
      success: false,
      message: `Connection failed: ${err}`
    };
  }
}

async function deployCamunda7(
  engine: EngineConfig,
  xml: string,
  fileName: string,
  headers: Record<string, string>
): Promise<DeploymentResult> {
  const formData = new FormData();
  const blob = new Blob([xml], { type: 'application/xml' });
  formData.append('deployment-name', fileName.replace('.bpmn', ''));
  formData.append('deployment-source', 'BAMOE VS Code Extension');
  formData.append('data', blob, fileName);

  if (engine.tenantId) {
    formData.append('tenant-id', engine.tenantId);
  }

  const response = await fetch(`${engine.url}/deployment/create`, {
    method: 'POST',
    headers,
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      success: false,
      message: `Deployment failed: ${response.status} ${response.statusText}`,
      details: { error: errorText }
    };
  }

  const result = await response.json();
  return {
    success: true,
    deploymentId: result.id,
    message: `Successfully deployed! Deployment ID: ${result.id}`,
    details: result
  };
}

async function deployCamunda8(
  engine: EngineConfig,
  xml: string,
  fileName: string,
  headers: Record<string, string>
): Promise<DeploymentResult> {
  // Camunda 8 uses gRPC, but we'll use the REST API if available
  // For zeebe-client REST API
  const response = await fetch(`${engine.url}/v1/deployments`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      resources: [{
        name: fileName,
        content: btoa(xml)
      }]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      success: false,
      message: `Deployment failed: ${response.status} ${response.statusText}`,
      details: { error: errorText }
    };
  }

  const result = await response.json();
  return {
    success: true,
    deploymentId: result.key?.toString(),
    message: `Successfully deployed! Deployment Key: ${result.key}`,
    details: result
  };
}

async function deployFlowable(
  engine: EngineConfig,
  xml: string,
  fileName: string,
  headers: Record<string, string>
): Promise<DeploymentResult> {
  const formData = new FormData();
  const blob = new Blob([xml], { type: 'application/xml' });
  formData.append('file', blob, fileName);

  if (engine.tenantId) {
    formData.append('tenantId', engine.tenantId);
  }

  const response = await fetch(`${engine.url}/service/repository/deployments`, {
    method: 'POST',
    headers,
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      success: false,
      message: `Deployment failed: ${response.status} ${response.statusText}`,
      details: { error: errorText }
    };
  }

  const result = await response.json();
  return {
    success: true,
    deploymentId: result.id,
    message: `Successfully deployed! Deployment ID: ${result.id}`,
    details: result
  };
}

async function deployCustom(
  engine: EngineConfig,
  xml: string,
  fileName: string,
  headers: Record<string, string>
): Promise<DeploymentResult> {
  // Generic deployment - POST XML to the configured URL
  const response = await fetch(engine.url, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/xml'
    },
    body: xml
  });

  if (!response.ok) {
    return {
      success: false,
      message: `Deployment failed: ${response.status} ${response.statusText}`
    };
  }

  return {
    success: true,
    message: 'Deployment request sent successfully'
  };
}

function createDeployPanelHTML(): HTMLDivElement {
  const panel = document.createElement('div');
  panel.id = 'deploy-panel';
  panel.className = 'deploy-panel';

  panel.innerHTML = `
    <div class="deploy-panel-header">
      <span class="deploy-panel-icon">🚀</span>
      <span class="deploy-panel-title">Deploy to Engine</span>
      <button class="deploy-panel-close" title="Close">&times;</button>
    </div>
    <div class="deploy-panel-body">
      <div class="deploy-field">
        <label>Workflow Engine</label>
        <div class="deploy-engine-row">
          <select id="deploy-engine-select"></select>
          <button id="add-engine-btn" class="deploy-add-btn" title="Add Engine">+</button>
        </div>
      </div>

      <div class="engine-form">
        <div class="engine-form-title">Add New Engine</div>
        <div class="deploy-field">
          <label>Type</label>
          <select id="engine-type">
            <option value="camunda7">Camunda 7</option>
            <option value="camunda8">Camunda 8</option>
            <option value="flowable">Flowable</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div class="deploy-field">
          <label>Name</label>
          <input type="text" id="engine-name" placeholder="My Engine" />
        </div>
        <div class="deploy-field">
          <label>URL</label>
          <input type="text" id="engine-url" placeholder="http://localhost:8080/engine-rest" />
        </div>
        <div class="deploy-field">
          <label>Username (optional)</label>
          <input type="text" id="engine-username" placeholder="admin" />
        </div>
        <div class="deploy-field">
          <label>Password (optional)</label>
          <input type="password" id="engine-password" />
        </div>
        <button id="save-engine-btn" class="deploy-save-btn">Save Engine</button>
      </div>

      <div class="deploy-status"></div>

      <button id="deploy-btn" class="deploy-btn">Deploy</button>

      <div class="deploy-help">
        <p><strong>Camunda 7:</strong> Requires REST API enabled</p>
        <p><strong>Camunda 8:</strong> Uses Zeebe REST API</p>
        <p><strong>Flowable:</strong> Requires REST API enabled</p>
      </div>
    </div>
  `;

  return panel;
}
