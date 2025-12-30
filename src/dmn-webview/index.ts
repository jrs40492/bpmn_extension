import DmnJS from 'dmn-js/lib/Modeler';

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
        parent: propertiesContainer
      },
      additionalModules: [
        DmnPropertiesPanelModule,
        DmnPropertiesProviderModule,
        inputDataPropertiesModule
      ]
    },
    common: {
      keyboard: {
        bindTo: document
      }
    }
  });

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

  // Track if we should skip the next change event
  let skipNextChange = false;
  let lastKnownXml = '';

  // Debounced function to send changes to extension
  const sendChange = debounce(async () => {
    try {
      const { xml } = await dmnModeler.saveXML({ format: true });
      // Normalize empty cells to "-" for IBM BPMN compatibility
      const normalizedXml = normalizeEmptyCells(xml);
      // Always send changes - extension-side handles deduplication
      postMessage({ type: 'change', xml: normalizedXml });
    } catch (err) {
      console.error('Failed to export DMN:', err);
    }
  }, 300);

  // Handler for command stack changes
  const handleCommandStackChanged = () => {
    if (skipNextChange) {
      skipNextChange = false;
      return;
    }
    sendChange();
  };

  // Listen for changes on the main modeler (for DRD changes)
  dmnModeler.on('commandStack.changed', handleCommandStackChanged);

  // Track the current active viewer to manage event listeners
  let currentActiveViewer: any = null;

  // Function to attach change listener to a viewer
  const attachViewerChangeListener = (viewer: any) => {
    if (!viewer) return;

    try {
      const eventBus = viewer.get('eventBus');
      if (eventBus) {
        eventBus.on('commandStack.changed', handleCommandStackChanged);
      }
    } catch (err) {
      // Viewer might not have eventBus (e.g., during initialization)
    }
  };

  // Function to detach change listener from a viewer
  const detachViewerChangeListener = (viewer: any) => {
    if (!viewer) return;

    try {
      const eventBus = viewer.get('eventBus');
      if (eventBus) {
        eventBus.off('commandStack.changed', handleCommandStackChanged);
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

  // Handle messages from the extension
  window.addEventListener('message', async (event) => {
    const message = event.data as ExtensionToWebviewMessage;

    switch (message.type) {
      case 'init':
        try {
          skipNextChange = true;
          lastKnownXml = message.xml;
          await dmnModeler.importXML(message.xml);

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
        } catch (err) {
          console.error('Failed to import DMN:', err);
          skipNextChange = false;
        }
        break;

      case 'update':
        try {
          if (message.xml === lastKnownXml) {
            break;
          }

          // Save current view
          const currentActiveView = activeView;

          skipNextChange = true;
          lastKnownXml = message.xml;
          await dmnModeler.importXML(message.xml);

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
          skipNextChange = false;
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
