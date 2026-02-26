import { createModeler, importDiagram, exportDiagram } from './bpmn-modeler';
import { setupMessageHandler, postMessage } from './message-handler';
import { initKafkaPanel } from './extensions/kafka-task/kafka-panel';
import { setAvailableDmnFiles, getAvailableDmnFiles, validateBusinessRuleTasks, handleCreateDmnFileResult } from './extensions/business-rule-task';
import { initTemplatesPanel } from './features/templates';
import { initSearchPanel } from './features/search';
import { initCommentsPanel } from './features/comments';
import { initDiffPanel } from './features/diff';
import { initCompliancePanel, validateAll, type ComplianceViolation } from './features/compliance';
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

// Import bpmnlint styles for visual lint overlays
import 'bpmn-js-bpmnlint/dist/assets/css/bpmn-js-bpmnlint.css';

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

  // Track the current file name (for project analysis)
  let currentFileName = 'diagram.bpmn';

  // Debounced function to send changes to extension
  const sendChange = debounce(async () => {
    try {
      const xml = await exportDiagram(modeler);
      postMessage(vscode, { type: 'change', xml });
    } catch (err) {
      console.error('Failed to export diagram:', err);
    }
  }, 300);

  // Get services needed for validation
  const eventBus = modeler.get('eventBus');
  const elementRegistry = modeler.get('elementRegistry');
  const selection = modeler.get('selection') as { select: (element: unknown) => void };

  // Store lint issues for compliance panel
  let storedLintIssues: Record<string, Array<{ id: string; message: string; category: 'error' | 'warn'; rule: string }>> = {};

  // Store reference to compliance panel (set later after initialization)
  let compliancePanelRef: { show: () => void } | null = null;

  // Validation status bar element
  const statusBar = document.getElementById('validation-status-bar');
  const statusIcon = statusBar?.querySelector('.validation-icon') as HTMLElement | null;
  const statusText = statusBar?.querySelector('.validation-text') as HTMLElement | null;

  // Update validation status bar
  function updateValidationStatusBar(violations: ComplianceViolation[]): void {
    if (!statusBar || !statusIcon || !statusText) return;

    const errors = violations.filter(v => v.severity === 'error').length;
    const warnings = violations.filter(v => v.severity === 'warning').length;

    // Remove all state classes
    statusBar.classList.remove('success', 'warning', 'error', 'loading');

    if (errors > 0) {
      statusBar.classList.add('error');
      statusIcon.textContent = '✕';
      statusText.textContent = `${errors} error${errors > 1 ? 's' : ''}${warnings > 0 ? `, ${warnings} warning${warnings > 1 ? 's' : ''}` : ''}`;
    } else if (warnings > 0) {
      statusBar.classList.add('warning');
      statusIcon.textContent = '⚠';
      statusText.textContent = `${warnings} warning${warnings > 1 ? 's' : ''}`;
    } else {
      statusBar.classList.add('success');
      statusIcon.textContent = '✓';
      statusText.textContent = 'No issues';
    }
  }

  // Show loading state on status bar
  function showValidationLoading(): void {
    if (!statusBar || !statusIcon || !statusText) return;
    statusBar.classList.remove('success', 'warning', 'error');
    statusBar.classList.add('loading');
    statusIcon.textContent = '↻';
    statusText.textContent = 'Validating...';
  }

  // Get overlays service for adding visual indicators on elements
  const overlays = modeler.get('overlays') as {
    add: (elementId: string, type: string, overlay: {
      position: { top?: number; bottom?: number; left?: number; right?: number };
      html: string | HTMLElement;
    }) => string;
    remove: (filter: { type?: string }) => void;
  };

  // Track overlay IDs for cleanup
  const VALIDATION_OVERLAY_TYPE = 'validation-issue';

  // Update validation overlays on elements
  function updateValidationOverlays(violations: ComplianceViolation[]): void {
    // Remove existing validation overlays
    try {
      overlays.remove({ type: VALIDATION_OVERLAY_TYPE });
    } catch (_e) {
      // Ignore errors when no overlays exist
    }

    // Group violations by element ID
    const violationsByElement = new Map<string, ComplianceViolation[]>();
    for (const violation of violations) {
      const existing = violationsByElement.get(violation.elementId) || [];
      existing.push(violation);
      violationsByElement.set(violation.elementId, existing);
    }

    // Add overlays for each element with violations
    for (const [elementId, elementViolations] of violationsByElement) {
      // Skip if element doesn't exist in registry
      const element = elementRegistry.get(elementId);
      if (!element) continue;

      // Determine severity (error takes precedence)
      const hasError = elementViolations.some(v => v.severity === 'error');
      const severityClass = hasError ? 'error' : 'warning';
      const count = elementViolations.length;

      // Create tooltip content as HTML list
      const tooltipItems = elementViolations.map(v =>
        `<div class="validation-tooltip-item ${v.severity}">
          <span class="validation-tooltip-icon">${v.severity === 'error' ? '✕' : '⚠'}</span>
          <span class="validation-tooltip-message">${v.message}</span>
        </div>`
      ).join('');

      // Create overlay HTML with hover tooltip
      const overlayHtml = document.createElement('div');
      overlayHtml.className = `validation-overlay ${severityClass}`;
      overlayHtml.innerHTML = `
        <span class="validation-badge">${count}</span>
        <div class="validation-tooltip">${tooltipItems}</div>
      `;

      // Add overlay to top-right corner of element (matching comment bubble positioning)
      try {
        overlays.add(elementId, VALIDATION_OVERLAY_TYPE, {
          position: { top: -10, right: 8 },
          html: overlayHtml
        });
      } catch (_e) {
        // Element might not support overlays (e.g., connections)
      }
    }
  }

  // Get linting service for triggering lint on demand
  const linting = modeler.get('linting') as {
    lint: () => Promise<Record<string, Array<{ id: string; message: string; category: string; rule: string }>>>;
    toggle: (active: boolean) => void;
  } | undefined;

  // Debounced function to run full validation
  const runValidationDebounced = debounce(async () => {
    try {
      // Get lint results first
      let lintIssues = storedLintIssues;
      if (linting) {
        const lintResults = await linting.lint();
        // Convert lint results - issues are keyed by element ID
        lintIssues = {};
        for (const [elementId, issues] of Object.entries(lintResults)) {
          if (!lintIssues[elementId]) {
            lintIssues[elementId] = [];
          }
          for (const issue of issues) {
            lintIssues[elementId].push({
              id: issue.id || elementId,
              message: issue.message,
              category: issue.category === 'error' ? 'error' : 'warn',
              rule: issue.rule || 'unknown'
            });
          }
        }
        storedLintIssues = lintIssues;
      }

      // Run full validation
      const elements = elementRegistry.getAll() as unknown[];
      const dmnFiles = getAvailableDmnFiles();
      const violations = validateAll(elements, lintIssues, dmnFiles);

      // Update status bar and element overlays
      updateValidationStatusBar(violations);
      updateValidationOverlays(violations);
    } catch (err) {
      console.error('Validation error:', err);
    }
  }, 500);

  // Listen for diagram changes
  eventBus.on('commandStack.changed', () => {
    if (skipNextChange) {
      skipNextChange = false;
      return;
    }
    sendChange();

    // Show loading state and run validation
    showValidationLoading();
    runValidationDebounced();

    // Re-run DMN validation after changes
    const dmnFiles = getAvailableDmnFiles();
    if (dmnFiles.length > 0) {
      const issues = validateBusinessRuleTasks(
        elementRegistry as Parameters<typeof validateBusinessRuleTasks>[0],
        dmnFiles
      );
      // Always send validation (even empty array to clear previous issues)
      postMessage(vscode, { type: 'validation', issues });
    }
  });

  // Handle validation results
  eventBus.on('linting.completed', (event: unknown) => {
    const lintEvent = event as { issues: Record<string, unknown[]> };
    const issues: ValidationIssue[] = [];

    // Reset stored issues
    storedLintIssues = {};

    // Flatten issues from all elements
    for (const [elementId, elementIssues] of Object.entries(lintEvent.issues)) {
      storedLintIssues[elementId] = [];
      for (const issue of elementIssues as Array<{ id: string; message: string; category: string; rule: string }>) {
        const normalizedIssue = {
          id: issue.id,
          message: issue.message,
          category: issue.category as 'error' | 'warn',
          rule: issue.rule
        };
        storedLintIssues[elementId].push(normalizedIssue);
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

  // Set up properties panel resize
  setupPropertiesPanelResize();

  // Initialize Kafka configuration panel
  const modeling = modeler.get('modeling');
  initKafkaPanel(eventBus, modeling);

  // Initialize Phase 3 features
  const canvas = modeler.get('canvas');

  // Templates panel
  const templatesPanel = initTemplatesPanel(async (xml) => {
    skipNextChange = true;
    await importDiagram(modeler, xml);
    skipNextChange = false;
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

  // Comments panel - pass bpmn-js services for persisting comments to BPMN elements
  const bpmnFactory = modeler.get('bpmnFactory');
  const commandStack = modeler.get('commandStack');
  const commentsPanel = initCommentsPanel(
    eventBus as Parameters<typeof initCommentsPanel>[0],
    bpmnFactory as Parameters<typeof initCommentsPanel>[1],
    commandStack as Parameters<typeof initCommentsPanel>[2],
    elementRegistry as Parameters<typeof initCommentsPanel>[3],
    overlays as Parameters<typeof initCommentsPanel>[4]
  );

  // Diff panel
  const diffPanel = initDiffPanel(
    () => exportDiagram(modeler),
    async (xml) => {
      skipNextChange = true;
      await importDiagram(modeler, xml);
      skipNextChange = false;
      const newXml = await exportDiagram(modeler);
      postMessage(vscode, { type: 'change', xml: newXml });
    },
    () => {
      postMessage(vscode, { type: 'requestGitDiff' });
    }
  );

  // Grid toggle
  const gridService = modeler.get('grid') as { toggle: (visible?: boolean) => void; isVisible: () => boolean } | undefined;
  const btnGrid = document.getElementById('btn-grid');
  if (btnGrid && gridService) {
    btnGrid.addEventListener('click', () => {
      gridService.toggle();
      btnGrid.classList.toggle('active', gridService.isVisible());
    });
  }

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

  // Compliance panel - pass lint issues provider function and linting trigger
  const compliancePanel = initCompliancePanel(
    () => elementRegistry.getAll() as unknown[],
    undefined,
    async () => {
      // Trigger linting before validation
      if (linting) {
        try {
          const lintResults = await linting.lint();

          // Convert lint results - issues are keyed by element ID
          // Each issue has: id (element id), message, category, rule
          const formattedIssues: Record<string, Array<{ id: string; message: string; category: 'error' | 'warn'; rule: string }>> = {};
          for (const [elementId, issues] of Object.entries(lintResults)) {
            if (!formattedIssues[elementId]) {
              formattedIssues[elementId] = [];
            }
            for (const issue of issues) {
              formattedIssues[elementId].push({
                id: issue.id || elementId,
                message: issue.message,
                category: issue.category === 'error' ? 'error' : 'warn',
                rule: issue.rule || 'unknown'
              });
            }
          }

          // Update stored lint issues and compliance panel
          storedLintIssues = formattedIssues;
          compliancePanel.setLintIssues(formattedIssues);
        } catch (err) {
          console.error('[BAMOE Compliance] Linting error:', err);
        }
      }
    }
  );

  // Store reference for use in validation overlays
  compliancePanelRef = compliancePanel;

  // Wire up lint issues to compliance panel when they change
  eventBus.on('linting.completed', () => {
    compliancePanel.setLintIssues(storedLintIssues);
    // Re-run validation to update status bar
    runValidationDebounced();
  });

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
    compliancePanel,
    extensionsPanel,
    projectsPanel
  );

  // Set up validation status bar click handler
  if (statusBar) {
    statusBar.addEventListener('click', () => {
      compliancePanel.show();
    });
  }

  // Handle messages from the extension
  setupMessageHandler(async (message: ExtensionToWebviewMessage) => {
    switch (message.type) {
      case 'init':
        try {
          skipNextChange = true;
          await importDiagram(modeler, message.xml);
          skipNextChange = false;

          // Fit to viewport on initial load
          const canvas = modeler.get('canvas');
          canvas.zoom('fit-viewport');

          // Run initial validation after diagram loads
          showValidationLoading();
          runValidationDebounced();
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
          skipNextChange = false;

          // Restore zoom and viewport position after import
          canvas.zoom(currentZoom);
          canvas.viewbox(currentViewbox);
        } catch (err) {
          console.error('Failed to import diagram:', err);
          skipNextChange = false;
        }
        break;

      case 'dmnFiles': {
        // Update available DMN files for Business Rule Task properties
        
        // Only update if something actually changed to prevent unnecessary re-validation/re-renders
        const currentFiles = getAvailableDmnFiles();
        const hasChanged = JSON.stringify(currentFiles) !== JSON.stringify(message.files);
        
        if (hasChanged) {
          setAvailableDmnFiles(message.files);

          // Update compliance panel with DMN files for validation
          compliancePanel.setDmnFiles(message.files);

          // Re-run full validation now that DMN files are available
          // This updates the status bar and element overlays
          runValidationDebounced();

          // Run DMN reference validation
          const dmnValidationIssues = validateBusinessRuleTasks(
            elementRegistry as Parameters<typeof validateBusinessRuleTasks>[0],
            message.files
          );
          if (dmnValidationIssues.length > 0) {
            postMessage(vscode, { type: 'validation', issues: dmnValidationIssues });
          }
        }
        break;
      }

      case 'createDmnFileResult':
        // Handle DMN file creation result
        console.log('[BAMOE Webview] Received createDmnFileResult:', message);
        handleCreateDmnFileResult({
          success: message.success,
          file: message.file,
          error: message.error
        });
        break;

      case 'gitDiffResponse':
        // Handle git diff response
        diffPanel.handleGitDiffResponse(message);
        break;

      case 'generateUserTaskFormResult':
        // Log form generation result (VS Code notification handles user feedback)
        if (message.success) {
          console.log('[BAMOE] Form generated:', message.filePath);
        } else {
          console.error('[BAMOE] Form generation failed:', message.error);
        }
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

// Set up properties panel resize
function setupPropertiesPanelResize(): void {
  const wrapper = document.getElementById('properties-panel-wrapper');
  const handle = document.getElementById('properties-resize-handle');

  if (!wrapper || !handle) {
    return;
  }

  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  const minWidth = 200;
  const maxWidth = 600;

  handle.addEventListener('mousedown', (e: MouseEvent) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = wrapper.offsetWidth;
    handle.classList.add('resizing');
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e: MouseEvent) => {
    if (!isResizing) return;

    // Calculate new width (dragging left increases width, dragging right decreases)
    const deltaX = startX - e.clientX;
    let newWidth = startWidth + deltaX;

    // Clamp to min/max
    newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

    wrapper.style.width = `${newWidth}px`;
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      handle.classList.remove('resizing');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });
}

// Set up toolbar button handlers
function setupToolbarButtons(
  templatesPanel: { show: () => void; hide: () => void },
  searchPanel: { show: () => void; hide: () => void; toggle: () => void },
  commentsPanel: { show: () => void; hide: () => void },
  diffPanel: { show: () => void; hide: () => void },
  toggleSimulation: () => void,
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
