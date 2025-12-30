import { createModeler, importDiagram, exportDiagram } from './bpmn-modeler';
import { setupMessageHandler, postMessage } from './message-handler';
import { initRestPanel } from './extensions/rest-task/rest-panel';
import { initKafkaPanel } from './extensions/kafka-task/kafka-panel';
import { setAvailableDmnFiles } from './extensions/business-rule-task';
import { initTemplatesPanel } from './features/templates';
import { initSearchPanel } from './features/search';
import { initCommentsPanel } from './features/comments';
import { initDiffPanel } from './features/diff';
import { initDeployPanel } from './features/deploy';
import { initCompliancePanel } from './features/compliance';
import { initExtensionsPanel } from './features/extensions';
import { initProjectsPanel, analyzeBpmnFile } from './features/projects';
import type { ExtensionToWebviewMessage, ValidationIssue, DmnFileInfo } from '../shared/message-types';

// Import bpmn-js styles
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';

// Import properties panel styles
import '@bpmn-io/properties-panel/dist/assets/properties-panel.css';

// Import minimap styles
import 'diagram-js-minimap/assets/diagram-js-minimap.css';

// Import token simulation styles
import 'bpmn-js-token-simulation/assets/css/bpmn-js-token-simulation.css';

// Import editor styles
import './styles/editor.css';

// Declare VS Code API type
declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

// Initialize VS Code API
const vscode = acquireVsCodeApi();

// Expose vscode API globally for properties providers
(window as any).vscodeApi = vscode;

// Debounce utility
function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

// Initialize the editor
async function init(): Promise<void> {
  const container = document.getElementById('canvas');
  const propertiesContainer = document.getElementById('properties-panel');

  if (!container) {
    console.error('Canvas container not found');
    return;
  }

  // Create the bpmn-js modeler with properties panel and minimap
  const modeler = createModeler(container, propertiesContainer);

  // Track if we should skip the next change event
  let skipNextChange = false;

  // Debounced function to send changes to extension
  const sendChange = debounce(async () => {
    try {
      const xml = await exportDiagram(modeler);
      postMessage(vscode, { type: 'change', xml });
    } catch (err) {
      console.error('Failed to export diagram:', err);
    }
  }, 300);

  // Listen for diagram changes
  const eventBus = modeler.get('eventBus');
  eventBus.on('commandStack.changed', () => {
    if (skipNextChange) {
      skipNextChange = false;
      return;
    }
    sendChange();
  });

  // Handle validation results
  eventBus.on('linting.completed', (event: unknown) => {
    const lintEvent = event as { issues: Record<string, unknown[]> };
    const issues: ValidationIssue[] = [];

    // Flatten issues from all elements
    for (const [elementId, elementIssues] of Object.entries(lintEvent.issues)) {
      for (const issue of elementIssues as Array<{ id: string; message: string; category: string; rule: string }>) {
        issues.push({
          id: elementId,
          message: issue.message,
          category: issue.category as 'error' | 'warn',
          rule: issue.rule
        });
      }
    }

    postMessage(vscode, { type: 'validation', issues });
  });

  // Set up zoom controls
  setupZoomControls(modeler);

  // Initialize REST configuration panel
  const modeling = modeler.get('modeling');
  initRestPanel(eventBus, modeling);

  // Initialize Kafka configuration panel
  initKafkaPanel(eventBus, modeling);

  // Initialize Phase 3 features
  const elementRegistry = modeler.get('elementRegistry');
  const selection = modeler.get('selection');
  const canvas = modeler.get('canvas');

  // Templates panel
  const templatesPanel = initTemplatesPanel(async (xml) => {
    skipNextChange = true;
    await importDiagram(modeler, xml);
    canvas.zoom('fit-viewport');
    // Trigger change to save the new diagram
    const newXml = await exportDiagram(modeler);
    postMessage(vscode, { type: 'change', xml: newXml });
  });

  // Search panel
  const searchPanel = initSearchPanel(
    elementRegistry as Parameters<typeof initSearchPanel>[0],
    canvas as Parameters<typeof initSearchPanel>[1],
    selection as Parameters<typeof initSearchPanel>[2]
  );

  // Comments panel
  const commentsPanel = initCommentsPanel(eventBus as Parameters<typeof initCommentsPanel>[0]);

  // Diff panel
  const diffPanel = initDiffPanel(
    () => exportDiagram(modeler),
    async (xml) => {
      skipNextChange = true;
      await importDiagram(modeler, xml);
      const newXml = await exportDiagram(modeler);
      postMessage(vscode, { type: 'change', xml: newXml });
    }
  );

  // Simulation toggle
  let simulationActive = false;
  const toggleSimulation = () => {
    try {
      const toggleMode = modeler.get('toggleMode');
      toggleMode.toggleMode();
      simulationActive = toggleMode.isActive();
      updateSimulationButton();
    } catch (e) {
      console.warn('Simulation toggle failed:', e);
    }
  };

  const updateSimulationButton = () => {
    const btn = document.getElementById('btn-simulate');
    if (btn) {
      btn.classList.toggle('active', simulationActive);
      const label = btn.querySelector('.toolbar-label');
      if (label) {
        label.textContent = simulationActive ? 'Stop' : 'Simulate';
      }
    }
  };

  // Initialize Phase 4 features

  // File name tracking
  const currentFileName = 'diagram.bpmn';

  // Deploy panel
  const deployPanel = initDeployPanel(
    () => exportDiagram(modeler),
    () => currentFileName
  );

  // Compliance panel
  const compliancePanel = initCompliancePanel(
    () => elementRegistry.getAll() as unknown[]
  );

  // Extensions panel
  const extensionsPanel = initExtensionsPanel();

  // Projects panel
  const projectsPanel = initProjectsPanel(
    (_filePath) => {
      // TODO: Implement VS Code message passing to open other files
      // This would require adding 'openFile' message type to shared/message-types.ts
    },
    async () => {
      // This would need VS Code message passing to list project files
      const xml = await exportDiagram(modeler);
      return [analyzeBpmnFile(xml, currentFileName)];
    }
  );

  // Set up toolbar buttons
  setupToolbarButtons(
    templatesPanel,
    searchPanel,
    commentsPanel,
    diffPanel,
    toggleSimulation,
    deployPanel,
    compliancePanel,
    extensionsPanel,
    projectsPanel
  );

  // Handle messages from the extension
  setupMessageHandler(async (message: ExtensionToWebviewMessage) => {
    switch (message.type) {
      case 'init':
        try {
          skipNextChange = true;
          await importDiagram(modeler, message.xml);

          // Fit to viewport on initial load
          const canvas = modeler.get('canvas');
          canvas.zoom('fit-viewport');
        } catch (err) {
          console.error('Failed to import diagram:', err);
          skipNextChange = false;
        }
        break;

      case 'update':
        try {
          // Save current zoom and viewport position before re-importing
          const canvas = modeler.get('canvas');
          const currentZoom = canvas.zoom();
          const currentViewbox = canvas.viewbox();

          skipNextChange = true;
          await importDiagram(modeler, message.xml);

          // Restore zoom and viewport position after import
          canvas.zoom(currentZoom);
          canvas.viewbox(currentViewbox);
        } catch (err) {
          console.error('Failed to import diagram:', err);
          skipNextChange = false;
        }
        break;

      case 'dmnFiles':
        // Update available DMN files for Business Rule Task properties
        console.log('[BAMOE Webview] Received dmnFiles:', message.files);
        setAvailableDmnFiles(message.files);
        break;
    }
  });

  // Notify extension that we're ready
  postMessage(vscode, { type: 'ready' });
}

// Set up zoom control buttons
function setupZoomControls(modeler: ReturnType<typeof createModeler>): void {
  const canvas = modeler.get('canvas');

  const zoomIn = document.getElementById('zoom-in');
  const zoomOut = document.getElementById('zoom-out');
  const zoomFit = document.getElementById('zoom-fit');
  const zoomReset = document.getElementById('zoom-reset');

  zoomIn?.addEventListener('click', () => {
    const currentZoom = canvas.zoom();
    canvas.zoom(currentZoom * 1.2);
  });

  zoomOut?.addEventListener('click', () => {
    const currentZoom = canvas.zoom();
    canvas.zoom(currentZoom / 1.2);
  });

  zoomFit?.addEventListener('click', () => {
    canvas.zoom('fit-viewport');
  });

  zoomReset?.addEventListener('click', () => {
    canvas.zoom(1);
  });
}

// Set up toolbar button handlers
function setupToolbarButtons(
  templatesPanel: { show: () => void; hide: () => void },
  searchPanel: { show: () => void; hide: () => void; toggle: () => void },
  commentsPanel: { show: () => void; hide: () => void },
  diffPanel: { show: () => void; hide: () => void },
  toggleSimulation: () => void,
  deployPanel: { show: () => void; hide: () => void },
  compliancePanel: { show: () => void; hide: () => void },
  extensionsPanel: { show: () => void; hide: () => void },
  projectsPanel: { show: () => void; hide: () => void }
): void {
  // Phase 3 buttons
  const btnTemplates = document.getElementById('btn-templates');
  const btnSearch = document.getElementById('btn-search');
  const btnSimulate = document.getElementById('btn-simulate');
  const btnComments = document.getElementById('btn-comments');
  const btnDiff = document.getElementById('btn-diff');

  // Phase 4 buttons
  const btnDeploy = document.getElementById('btn-deploy');
  const btnCompliance = document.getElementById('btn-compliance');
  const btnExtensions = document.getElementById('btn-extensions');
  const btnProject = document.getElementById('btn-project');

  // Phase 3 handlers
  btnTemplates?.addEventListener('click', () => templatesPanel.show());
  btnSearch?.addEventListener('click', () => searchPanel.toggle());
  btnSimulate?.addEventListener('click', () => toggleSimulation());
  btnComments?.addEventListener('click', () => commentsPanel.show());
  btnDiff?.addEventListener('click', () => diffPanel.show());

  // Phase 4 handlers
  btnDeploy?.addEventListener('click', () => deployPanel.show());
  btnCompliance?.addEventListener('click', () => compliancePanel.show());
  btnExtensions?.addEventListener('click', () => extensionsPanel.show());
  btnProject?.addEventListener('click', () => projectsPanel.show());

  // Keyboard shortcut for search (Ctrl+F)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      searchPanel.toggle();
    }
  });
}

// Start the editor when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
