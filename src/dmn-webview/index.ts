import DmnJS from 'dmn-js/lib/Modeler';

// Import DMN validation feature
import { initDmnValidationPanel, type DmnValidationIssue } from './features/validation';

// Import dmn-js styles
import 'dmn-js/dist/assets/diagram-js.css';
import 'dmn-js/dist/assets/dmn-js-shared.css';
import 'dmn-js/dist/assets/dmn-js-drd.css';
import 'dmn-js/dist/assets/dmn-js-decision-table.css';
import 'dmn-js/dist/assets/dmn-js-literal-expression.css';
import 'dmn-js/dist/assets/dmn-font/css/dmn.css';

// Import dmn-js-properties-panel
import {
  DmnPropertiesPanelModule,
  DmnPropertiesProviderModule
} from 'dmn-js-properties-panel';
import 'dmn-js-properties-panel/dist/assets/properties-panel.css';

// Import editor styles
import './styles/dmn-editor.css';

// Import FEEL support extension
import { initFeelSupport, type FeelSupportController } from './extensions/feel-support';

// Import custom InputData properties extension
import inputDataPropertiesModule from './extensions/input-data-properties';

// Import custom Decision Output properties extension
import decisionOutputPropertiesModule from './extensions/decision-output-properties';

// Types
interface DmnView {
  id: string;
  name: string;
  type: string;
  element?: any;
}

interface ExtensionToWebviewMessage {
  type: 'init' | 'update';
  xml: string;
  isUntitled?: boolean;
}

// Declare VS Code API type
declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

// Initialize VS Code API
const vscode = acquireVsCodeApi();

// Post message helper
function postMessage(message: unknown): void {
  vscode.postMessage(message);
}

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

/**
 * Returns an empty DMN diagram XML for new files
 */
function getEmptyDmnDiagram(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
             xmlns:dmndi="https://www.omg.org/spec/DMN/20191111/DMNDI/"
             xmlns:dc="http://www.omg.org/spec/DMN/20180521/DC/"
             xmlns:di="http://www.omg.org/spec/DMN/20180521/DI/"
             id="Definitions_1"
             name="DRD"
             namespace="http://camunda.org/schema/1.0/dmn">
  <dmndi:DMNDI>
    <dmndi:DMNDiagram id="DMNDiagram_1">
    </dmndi:DMNDiagram>
  </dmndi:DMNDI>
</definitions>`;
}

// Normalize empty decision table cells to use "-" (any value) for IBM BPMN compatibility
function normalizeEmptyCells(xml: string): string {
  // Replace empty <text></text> within inputEntry elements with <text>-</text>
  // The "-" represents "any value" (don't care) in DMN decision tables
  xml = xml.replace(
    /(<inputEntry[^>]*>)(\s*)<text><\/text>(\s*)(<\/inputEntry>)/g,
    '$1$2<text>-</text>$3$4'
  );

  // Replace empty <text></text> within outputEntry elements with <text>-</text>
  xml = xml.replace(
    /(<outputEntry[^>]*>)(\s*)<text><\/text>(\s*)(<\/outputEntry>)/g,
    '$1$2<text>-</text>$3$4'
  );

  return xml;
}

// Initialize the editor
async function init(): Promise<void> {
  const container = document.getElementById('dmn-canvas');
  const propertiesContainer = document.getElementById('dmn-properties');
  const tabsContainer = document.getElementById('view-tabs');

  if (!container) {
    return;
  }

  // Create the dmn-js modeler with properties panel
  const dmnModeler = new DmnJS({
    container,
    drd: {
      propertiesPanel: {
        parent: '#dmn-properties'
      },
      additionalModules: [
        DmnPropertiesPanelModule,
        DmnPropertiesProviderModule,
        inputDataPropertiesModule,
        decisionOutputPropertiesModule
      ]
    },
    common: {
      keyboard: {
        bindTo: document
      }
    }
  });

  console.log('[DMN Editor] Properties panel container:', propertiesContainer);
  console.log('[DMN Editor] DRD modules loaded:', DmnPropertiesPanelModule, DmnPropertiesProviderModule);

  // Debug: Listen for clicks on the properties panel
  if (propertiesContainer) {
    propertiesContainer.addEventListener('click', (e) => {
      console.log('[DMN Editor] Properties panel clicked:', e.target);
      console.log('[DMN Editor] Target classes:', (e.target as HTMLElement).className);
    }, true); // Use capture phase
  }

  // Initialize FEEL support for expression validation and syntax highlighting
  let feelController: FeelSupportController | null = null;
  try {
    feelController = initFeelSupport(dmnModeler);
    console.log('[DMN Editor] FEEL support initialized');
  } catch (err) {
    console.warn('[DMN Editor] Failed to initialize FEEL support:', err);
  }

  // Track views for tab navigation
  let currentViews: DmnView[] = [];
  let activeView: DmnView | null = null;

  // Debounced function to send changes to extension
  // Extension-side handles deduplication, so we always send
  const sendChange = debounce(async () => {
    console.log('[DMN Editor] sendChange executing...');
    try {
      const { xml } = await dmnModeler.saveXML({ format: true });
      console.log('[DMN Editor] saveXML completed, xml length:', xml.length);
      // Normalize empty cells to "-" for IBM BPMN compatibility
      const normalizedXml = normalizeEmptyCells(xml);
      console.log('[DMN Editor] Posting change message to extension');
      postMessage({ type: 'change', xml: normalizedXml });
    } catch (err) {
      console.error('Failed to export DMN:', err);
    }
  }, 300);

  // Handler for command stack changes
  const handleCommandStackChanged = () => {
    console.log('[DMN Editor] commandStack.changed event fired');
    sendChange();
  };

  // Listen for changes on the main modeler (for DRD changes)
  dmnModeler.on('commandStack.changed', handleCommandStackChanged);

  // Also listen for element changes which fire more reliably in some cases
  dmnModeler.on('elements.changed', () => {
    console.log('[DMN Editor] elements.changed event fired');
    sendChange();
  });

  // Listen for import.done to ensure we catch the initial state
  dmnModeler.on('import.done', () => {
    console.log('[DMN Editor] import.done event fired');
  });

  // Listen for custom properties changed events from extensions
  // This is needed because the DRD viewer's eventBus is isolated from the main modeler
  window.addEventListener('dmn-properties-changed', (event) => {
    console.log('[DMN Editor] Received dmn-properties-changed event:', (event as CustomEvent).detail);
    sendChange();
  });

  // Fallback: Listen for input/change events on the canvas to catch all edits
  // This catches changes that might not trigger dmn-js events
  if (container) {
    container.addEventListener('input', () => {
      console.log('[DMN Editor] Input event detected in container');
      sendChange();
    }, true);

    container.addEventListener('change', () => {
      console.log('[DMN Editor] Change event detected in container');
      sendChange();
    }, true);

    // Also listen for blur events which indicate editing completed
    container.addEventListener('blur', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' ||
          (e.target as HTMLElement)?.tagName === 'TEXTAREA' ||
          (e.target as HTMLElement)?.getAttribute('contenteditable')) {
        console.log('[DMN Editor] Blur event on editable element');
        sendChange();
      }
    }, true);
  }

  // Track the current active viewer to manage event listeners
  let currentActiveViewer: any = null;

  // Handler for viewer-specific changes (bypasses skipNextChange for reliability)
  const handleViewerChange = () => {
    console.log('[DMN Editor] Viewer change detected');
    sendChange();
  };

  // Function to attach change listener to a viewer
  const attachViewerChangeListener = (viewer: any) => {
    if (!viewer) return;

    try {
      const eventBus = viewer.get('eventBus');
      if (eventBus) {
        // Listen to multiple events to catch all changes
        eventBus.on('commandStack.changed', handleViewerChange);
        eventBus.on('elements.changed', handleViewerChange);
        eventBus.on('element.changed', handleViewerChange);
        console.log('[DMN Editor] Attached change listeners to viewer');
      }
    } catch (err) {
      // Viewer might not have eventBus (e.g., during initialization)
      console.log('[DMN Editor] Could not attach listeners to viewer:', err);
    }
  };

  // Function to detach change listener from a viewer
  const detachViewerChangeListener = (viewer: any) => {
    if (!viewer) return;

    try {
      const eventBus = viewer.get('eventBus');
      if (eventBus) {
        eventBus.off('commandStack.changed', handleViewerChange);
        eventBus.off('elements.changed', handleViewerChange);
        eventBus.off('element.changed', handleViewerChange);
      }
    } catch (err) {
      // Ignore errors during cleanup
    }
  };

  // Listen for view switches to attach/detach listeners
  dmnModeler.on('views.changed', (event: any) => {
    // Detach from previous viewer
    if (currentActiveViewer) {
      detachViewerChangeListener(currentActiveViewer);
    }

    // Get the new active viewer and attach listener
    const newActiveViewer = dmnModeler.getActiveViewer();
    if (newActiveViewer && newActiveViewer !== currentActiveViewer) {
      attachViewerChangeListener(newActiveViewer);
      currentActiveViewer = newActiveViewer;
    }
  });

  // Also attach to initial active viewer after import
  const attachToCurrentViewer = () => {
    const viewer = dmnModeler.getActiveViewer();
    if (viewer && viewer !== currentActiveViewer) {
      if (currentActiveViewer) {
        detachViewerChangeListener(currentActiveViewer);
      }
      attachViewerChangeListener(viewer);
      currentActiveViewer = viewer;
    }
  };

  // Listen for views changes (when switching between DRD, Decision Table, etc.)
  dmnModeler.on('views.changed', ((event: { views: DmnView[]; activeView: DmnView }) => {
    currentViews = event.views;
    activeView = event.activeView;
    updateTabs();
  }) as (...args: unknown[]) => void);

  // Update tabs UI
  function updateTabs(): void {
    if (!tabsContainer) return;

    tabsContainer.innerHTML = '';

    currentViews.forEach((view) => {
      const tab = document.createElement('button');
      tab.className = `toolbar-tab ${view === activeView ? 'active' : ''}`;
      tab.textContent = getViewLabel(view);
      tab.title = getViewTooltip(view);
      tab.addEventListener('click', () => {
        dmnModeler.open(view);
      });
      tabsContainer.appendChild(tab);
    });
  }

  // Get human-readable label for view
  function getViewLabel(view: DmnView): string {
    if (view.type === 'drd') {
      return 'DRD';
    }
    return view.name || view.id || 'View';
  }

  // Get tooltip for view
  function getViewTooltip(view: DmnView): string {
    switch (view.type) {
      case 'drd':
        return 'Decision Requirements Diagram';
      case 'decisionTable':
        return 'Decision Table';
      case 'literalExpression':
        return 'Literal Expression';
      default:
        return view.type;
    }
  }

  // Set up zoom controls
  setupZoomControls(dmnModeler);

  // Set up FEEL reference button
  const feelRefBtn = document.getElementById('btn-feel-ref');
  if (feelRefBtn && feelController) {
    feelRefBtn.addEventListener('click', () => {
      feelController?.showQuickReference();
    });
  }

  // Set up DMN validation panel
  const validationPanel = initDmnValidationPanel(
    dmnModeler as unknown as Parameters<typeof initDmnValidationPanel>[0],
    (issues: DmnValidationIssue[]) => {
      // Send validation issues to VS Code extension for Problems panel
      const validationIssues = issues.map(issue => ({
        id: issue.elementId,
        message: issue.message,
        category: issue.severity === 'error' ? 'error' : 'warn',
        rule: issue.rule
      }));
      postMessage({ type: 'validation', issues: validationIssues });
    }
  );

  // Set up Validate button
  const validateBtn = document.getElementById('btn-validate');
  if (validateBtn) {
    validateBtn.addEventListener('click', () => {
      validationPanel.show();
    });
  }

  // Handle messages from the extension
  window.addEventListener('message', async (event) => {
    const message = event.data as ExtensionToWebviewMessage;

    switch (message.type) {
      case 'init':
        try {
          // Use empty diagram for new/empty files
          let xmlToImport = message.xml;
          if (!xmlToImport || xmlToImport.trim() === '') {
            xmlToImport = getEmptyDmnDiagram();
          }
          await dmnModeler.importXML(xmlToImport);

          // Attach change listener to the active viewer (decision table, etc.)
          attachToCurrentViewer();

          // Fit to viewport on initial load
          const activeViewer = dmnModeler.getActiveViewer();
          if (activeViewer) {
            const canvas = activeViewer.get('canvas');
            if (canvas && typeof canvas.zoom === 'function') {
              canvas.zoom('fit-viewport');
            }
          }

          // If we used the empty diagram for a new file, trigger a save
          // so the file gets the initial DMN structure
          if (message.xml !== xmlToImport) {
            sendChange();
          }
        } catch (err) {
          console.error('Failed to import DMN:', err);
        }
        break;

      case 'update':
        try {
          // Use empty diagram for empty content
          let xmlToUpdate = message.xml;
          if (!xmlToUpdate || xmlToUpdate.trim() === '') {
            xmlToUpdate = getEmptyDmnDiagram();
          }

          // Save current view
          const currentActiveView = activeView;

          await dmnModeler.importXML(xmlToUpdate);

          // Attach change listener to the active viewer
          attachToCurrentViewer();

          // Try to restore the view
          if (currentActiveView) {
            const newViews = dmnModeler.getViews();
            const matchingView = newViews.find((v: DmnView) => v.id === currentActiveView.id);
            if (matchingView) {
              dmnModeler.open(matchingView);
            }
          }
        } catch (err) {
          console.error('Failed to import DMN:', err);
        }
        break;
    }
  });

  // Notify extension that we're ready
  postMessage({ type: 'ready' });
}

// Set up zoom control buttons
function setupZoomControls(dmnModeler: any): void {
  const zoomIn = document.getElementById('btn-zoom-in');
  const zoomOut = document.getElementById('btn-zoom-out');
  const zoomFit = document.getElementById('btn-zoom-fit');

  const getCanvas = () => {
    const activeViewer = dmnModeler.getActiveViewer();
    if (activeViewer) {
      try {
        return activeViewer.get('canvas');
      } catch {
        return null;
      }
    }
    return null;
  };

  zoomIn?.addEventListener('click', () => {
    const canvas = getCanvas();
    if (canvas && typeof canvas.zoom === 'function') {
      const currentZoom = canvas.zoom();
      canvas.zoom(currentZoom * 1.2);
    }
  });

  zoomOut?.addEventListener('click', () => {
    const canvas = getCanvas();
    if (canvas && typeof canvas.zoom === 'function') {
      const currentZoom = canvas.zoom();
      canvas.zoom(currentZoom / 1.2);
    }
  });

  zoomFit?.addEventListener('click', () => {
    const canvas = getCanvas();
    if (canvas && typeof canvas.zoom === 'function') {
      canvas.zoom('fit-viewport');
    }
  });
}

// Start the editor when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
