import DmnJS from 'dmn-js/lib/Modeler';

// Import dmn-js styles
import 'dmn-js/dist/assets/diagram-js.css';
import 'dmn-js/dist/assets/dmn-js-shared.css';
import 'dmn-js/dist/assets/dmn-js-drd.css';
import 'dmn-js/dist/assets/dmn-js-decision-table.css';
import 'dmn-js/dist/assets/dmn-js-literal-expression.css';
import 'dmn-js/dist/assets/dmn-font/css/dmn.css';

// Import editor styles
import './styles/dmn-editor.css';

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

// Initialize the editor
async function init(): Promise<void> {
  const container = document.getElementById('dmn-canvas');
  const propertiesContainer = document.getElementById('dmn-properties');
  const tabsContainer = document.getElementById('view-tabs');

  if (!container) {
    return;
  }

  // Create the dmn-js modeler
  const dmnModeler = new DmnJS({
    container,
    common: {
      keyboard: {
        bindTo: document
      }
    }
  });

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
      if (xml !== lastKnownXml) {
        lastKnownXml = xml;
        postMessage({ type: 'change', xml });
      }
    } catch (err) {
      console.error('Failed to export DMN:', err);
    }
  }, 300);

  // Listen for changes in the modeler
  dmnModeler.on('commandStack.changed', () => {
    if (skipNextChange) {
      skipNextChange = false;
      return;
    }
    sendChange();
  });

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

  // Handle messages from the extension
  window.addEventListener('message', async (event) => {
    const message = event.data as ExtensionToWebviewMessage;

    switch (message.type) {
      case 'init':
        try {
          skipNextChange = true;
          lastKnownXml = message.xml;
          await dmnModeler.importXML(message.xml);

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
