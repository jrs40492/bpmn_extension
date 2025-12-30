/**
 * FEEL Support Extension for DMN Editor
 *
 * Provides FEEL expression validation, syntax highlighting, and quick reference
 * for DMN decision tables using the feelin library (Drools-compatible).
 *
 * Features:
 * - Real-time FEEL expression validation
 * - Syntax error highlighting with position info
 * - Expression type detection (range, comparison, function, etc.)
 * - Built-in function documentation
 * - Quick reference panel
 *
 * @see https://github.com/nikku/feelin
 * @see https://kiegroup.github.io/dmn-feel-handbook/
 */

// Re-export all FEEL services
export * from './feel-service';
export * from './feel-validator';

// Import CSS
import './feel-highlighting.css';

import {
  validateExpression,
  validateUnaryTest,
  evaluateExpression,
  evaluateUnaryTest,
  getExpressionType,
  FEEL_FUNCTIONS
} from './feel-service';

import {
  FeelValidator,
  feelValidator,
  createErrorTooltip,
  createSignatureTooltip,
  applyCellValidationStyle,
  createValidationPanel,
  createQuickReferencePanel
} from './feel-validator';

/**
 * Initialize FEEL support for a DMN modeler instance
 */
export function initFeelSupport(dmnModeler: any): FeelSupportController {
  const controller = new FeelSupportController(dmnModeler);
  controller.init();
  return controller;
}

/**
 * FEEL Support Controller
 *
 * Manages FEEL validation and UI integration with dmn-js
 */
export class FeelSupportController {
  private dmnModeler: any;
  private validator: FeelValidator;
  private validationPanel: HTMLElement | null = null;
  private quickReferencePanel: HTMLElement | null = null;
  private activeTooltip: HTMLElement | null = null;
  private isEnabled: boolean = true;

  constructor(dmnModeler: any) {
    this.dmnModeler = dmnModeler;
    this.validator = new FeelValidator();
  }

  /**
   * Initialize FEEL support
   */
  init(): void {
    // Listen for view changes
    this.dmnModeler.on('views.changed', (event: any) => {
      if (event.activeView?.type === 'decisionTable') {
        this.attachToDecisionTable();
      }
    });

    // Listen for cell changes in decision tables
    this.dmnModeler.on('commandStack.changed', () => {
      if (this.isEnabled) {
        this.validateCurrentTable();
      }
    });

    // Set up validation change handler
    this.validator.setOnValidationChange((report) => {
      this.updateValidationPanel(report);
    });

    console.log('[FEEL Support] Initialized');
  }

  /**
   * Enable or disable FEEL validation
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (enabled) {
      this.validateCurrentTable();
    } else {
      this.validator.clear();
      this.hideValidationPanel();
    }
  }

  /**
   * Attach to the current decision table view
   */
  private attachToDecisionTable(): void {
    const activeViewer = this.dmnModeler.getActiveViewer();
    if (!activeViewer) return;

    try {
      // Get the decision table modeling services
      const sheet = activeViewer.get('sheet');
      const eventBus = activeViewer.get('eventBus');

      // Listen for cell editing events
      eventBus.on('cell.changed', (event: any) => {
        if (this.isEnabled && event.cell) {
          this.validateCell(event.cell);
        }
      });

      // Listen for selection changes to show function signatures
      eventBus.on('selection.changed', (event: any) => {
        this.hideTooltip();
      });

      // Initial validation
      this.validateCurrentTable();

    } catch (err) {
      console.warn('[FEEL Support] Could not attach to decision table:', err);
    }
  }

  /**
   * Validate a single cell
   */
  private validateCell(cell: any): void {
    if (!cell || !cell.id) return;

    const value = cell.businessObject?.text || '';
    const isInputCell = this.isInputCell(cell);

    const validation = this.validator.validateCell(cell.id, value, isInputCell);

    // Apply styling to the cell element
    const cellElement = document.querySelector(`[data-element-id="${cell.id}"]`);
    if (cellElement) {
      applyCellValidationStyle(cellElement as HTMLElement, validation);
    }
  }

  /**
   * Validate all cells in the current decision table
   */
  private validateCurrentTable(): void {
    const activeViewer = this.dmnModeler.getActiveViewer();
    if (!activeViewer) return;

    try {
      const sheet = activeViewer.get('sheet');
      const root = sheet.getRoot();

      if (!root || !root.rows) return;

      const cells: Array<{ id: string; value: string; isInput: boolean }> = [];

      // Collect all cells from the decision table
      for (const row of root.rows) {
        if (row.cells) {
          for (const cell of row.cells) {
            if (cell && cell.id) {
              cells.push({
                id: cell.id,
                value: cell.businessObject?.text || '',
                isInput: this.isInputCell(cell)
              });
            }
          }
        }
      }

      // Validate all cells
      const report = this.validator.validateDecisionTable(cells);

      // Apply styling to all cell elements
      for (const [cellId, validation] of this.validator['validationResults']) {
        const cellElement = document.querySelector(`[data-element-id="${cellId}"]`);
        if (cellElement) {
          applyCellValidationStyle(cellElement as HTMLElement, validation);
        }
      }

    } catch (err) {
      console.warn('[FEEL Support] Could not validate decision table:', err);
    }
  }

  /**
   * Check if a cell is an input cell (vs output cell)
   */
  private isInputCell(cell: any): boolean {
    // In dmn-js, input cells are in inputEntry elements
    const businessObject = cell.businessObject;
    if (!businessObject) return false;

    const parent = businessObject.$parent;
    return parent?.$type === 'dmn:DecisionRule' &&
           businessObject.$type === 'dmn:UnaryTests';
  }

  /**
   * Show error tooltip at position
   */
  showErrorTooltip(cellId: string, x: number, y: number): void {
    const validation = this.validator.getCellValidation(cellId);
    if (!validation || validation.result.valid) return;

    this.hideTooltip();
    this.activeTooltip = createErrorTooltip(validation.result.errors, x, y);
    document.body.appendChild(this.activeTooltip);
  }

  /**
   * Show function signature tooltip
   */
  showSignatureTooltip(functionName: string, x: number, y: number): void {
    this.hideTooltip();
    this.activeTooltip = createSignatureTooltip(functionName, x, y);
    if (this.activeTooltip) {
      document.body.appendChild(this.activeTooltip);
    }
  }

  /**
   * Hide any active tooltip
   */
  hideTooltip(): void {
    if (this.activeTooltip) {
      this.activeTooltip.remove();
      this.activeTooltip = null;
    }
  }

  /**
   * Update or create validation panel
   */
  private updateValidationPanel(report: any): void {
    if (this.validationPanel) {
      this.validationPanel.remove();
    }

    if (report.invalidCells > 0 || report.warnings > 0) {
      this.validationPanel = createValidationPanel(report);
      // Find a suitable container for the panel
      const container = document.querySelector('.dmn-decision-table-container') ||
                       document.getElementById('dmn-canvas');
      if (container) {
        container.appendChild(this.validationPanel);
      }
    }
  }

  /**
   * Hide validation panel
   */
  private hideValidationPanel(): void {
    if (this.validationPanel) {
      this.validationPanel.remove();
      this.validationPanel = null;
    }
  }

  /**
   * Show quick reference panel
   */
  showQuickReference(): void {
    if (this.quickReferencePanel) {
      this.quickReferencePanel.remove();
      this.quickReferencePanel = null;
      return;
    }

    this.quickReferencePanel = createQuickReferencePanel();

    // Position the panel
    const container = document.getElementById('dmn-canvas');
    if (container) {
      this.quickReferencePanel.style.position = 'absolute';
      this.quickReferencePanel.style.right = '20px';
      this.quickReferencePanel.style.top = '60px';
      container.appendChild(this.quickReferencePanel);
    }
  }

  /**
   * Get the FEEL functions documentation
   */
  getFunctions(): typeof FEEL_FUNCTIONS {
    return FEEL_FUNCTIONS;
  }

  /**
   * Evaluate a FEEL expression (for testing)
   */
  evaluate(expression: string, context: Record<string, any> = {}): any {
    return evaluateExpression(expression, context);
  }

  /**
   * Test a unary expression against a value
   */
  testUnary(expression: string, inputValue: any, context: Record<string, any> = {}): any {
    return evaluateUnaryTest(expression, inputValue, context);
  }

  /**
   * Get validation report
   */
  getValidationReport(): any {
    return this.validator.getReport();
  }

  /**
   * Dispose of the controller
   */
  dispose(): void {
    this.hideTooltip();
    this.hideValidationPanel();
    if (this.quickReferencePanel) {
      this.quickReferencePanel.remove();
    }
    this.validator.clear();
  }
}

// Export the validator instance for direct use
export { feelValidator };
