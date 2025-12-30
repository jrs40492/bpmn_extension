/**
 * FEEL Expression Validator for DMN Decision Tables
 *
 * Provides real-time validation of FEEL expressions in decision table cells
 * and displays errors/warnings to the user.
 */

import {
  validateExpression,
  validateUnaryTest,
  getExpressionType,
  FEEL_FUNCTIONS,
  type FeelError,
  type FeelValidationResult
} from './feel-service';

export interface CellValidation {
  cellId: string;
  expression: string;
  isInputCell: boolean;
  result: FeelValidationResult;
  expressionType: ReturnType<typeof getExpressionType>;
}

export interface ValidationReport {
  totalCells: number;
  validCells: number;
  invalidCells: number;
  warnings: number;
  errors: CellValidation[];
}

/**
 * FEEL Validator class for DMN decision tables
 */
export class FeelValidator {
  private validationResults: Map<string, CellValidation> = new Map();
  private onValidationChange?: (report: ValidationReport) => void;

  constructor() {
    this.validationResults = new Map();
  }

  /**
   * Set callback for validation changes
   */
  setOnValidationChange(callback: (report: ValidationReport) => void): void {
    this.onValidationChange = callback;
  }

  /**
   * Validate a single cell expression
   */
  validateCell(cellId: string, expression: string, isInputCell: boolean): CellValidation {
    const result = isInputCell
      ? validateUnaryTest(expression)
      : validateExpression(expression);

    const validation: CellValidation = {
      cellId,
      expression,
      isInputCell,
      result,
      expressionType: getExpressionType(expression)
    };

    this.validationResults.set(cellId, validation);
    this.notifyChange();

    return validation;
  }

  /**
   * Validate all cells in a decision table
   */
  validateDecisionTable(cells: Array<{ id: string; value: string; isInput: boolean }>): ValidationReport {
    this.validationResults.clear();

    for (const cell of cells) {
      this.validateCell(cell.id, cell.value, cell.isInput);
    }

    return this.getReport();
  }

  /**
   * Get validation result for a specific cell
   */
  getCellValidation(cellId: string): CellValidation | undefined {
    return this.validationResults.get(cellId);
  }

  /**
   * Get all validation errors
   */
  getErrors(): CellValidation[] {
    return Array.from(this.validationResults.values())
      .filter(v => !v.result.valid);
  }

  /**
   * Get validation report
   */
  getReport(): ValidationReport {
    const all = Array.from(this.validationResults.values());
    const errors = all.filter(v => !v.result.valid);
    const warnings = all.filter(v =>
      v.result.valid && v.result.errors.some(e => e.severity === 'warning')
    );

    return {
      totalCells: all.length,
      validCells: all.length - errors.length,
      invalidCells: errors.length,
      warnings: warnings.length,
      errors
    };
  }

  /**
   * Clear all validation results
   */
  clear(): void {
    this.validationResults.clear();
    this.notifyChange();
  }

  /**
   * Remove validation for a specific cell
   */
  removeCell(cellId: string): void {
    this.validationResults.delete(cellId);
    this.notifyChange();
  }

  private notifyChange(): void {
    if (this.onValidationChange) {
      this.onValidationChange(this.getReport());
    }
  }
}

/**
 * Create error tooltip element
 */
export function createErrorTooltip(errors: FeelError[], x: number, y: number): HTMLElement {
  const tooltip = document.createElement('div');
  tooltip.className = 'feel-error-tooltip';
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;

  const errorList = errors.map(e =>
    `<div class="error-item">
      <span class="error-icon">${e.severity === 'error' ? '!' : '?'}</span>
      <span class="error-message">${escapeHtml(e.message)}</span>
    </div>`
  ).join('');

  tooltip.innerHTML = errorList;
  return tooltip;
}

/**
 * Create function signature tooltip
 */
export function createSignatureTooltip(functionName: string, x: number, y: number): HTMLElement | null {
  const funcInfo = FEEL_FUNCTIONS[functionName.toLowerCase()];
  if (!funcInfo) return null;

  const tooltip = document.createElement('div');
  tooltip.className = 'feel-signature-tooltip';
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;

  tooltip.innerHTML = `
    <div class="signature">${escapeHtml(funcInfo.signature)}</div>
    <div class="description">${escapeHtml(funcInfo.description)}</div>
    <div class="example">${escapeHtml(funcInfo.example)}</div>
  `;

  return tooltip;
}

/**
 * Apply validation styling to a cell element
 */
export function applyCellValidationStyle(cellElement: HTMLElement, validation: CellValidation): void {
  // Remove existing validation classes
  cellElement.classList.remove('feel-valid', 'feel-invalid', 'feel-warning');

  if (!validation.expression || validation.expression.trim() === '-') {
    return; // Empty or "any" cells don't need validation styling
  }

  if (validation.result.valid) {
    if (validation.result.errors.some(e => e.severity === 'warning')) {
      cellElement.classList.add('feel-warning');
    } else {
      cellElement.classList.add('feel-valid');
    }
  } else {
    cellElement.classList.add('feel-invalid');
  }

  // Add expression type badge if needed
  const existingBadge = cellElement.querySelector('.feel-expression-type');
  if (existingBadge) {
    existingBadge.remove();
  }

  if (validation.expressionType !== 'empty' && validation.expressionType !== 'literal') {
    const badge = document.createElement('span');
    badge.className = `feel-expression-type ${validation.expressionType}`;
    badge.textContent = validation.expressionType;
    cellElement.appendChild(badge);
  }
}

/**
 * Create validation panel element
 */
export function createValidationPanel(report: ValidationReport): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'feel-validation-panel';

  const hasErrors = report.invalidCells > 0;
  const hasWarnings = report.warnings > 0;

  let statusIcon = '✓';
  let statusColor = 'var(--feel-valid-color)';
  if (hasErrors) {
    statusIcon = '!';
    statusColor = 'var(--feel-error-color)';
  } else if (hasWarnings) {
    statusIcon = '?';
    statusColor = 'var(--feel-warning-color)';
  }

  panel.innerHTML = `
    <div class="title">
      <span style="color: ${statusColor}">${statusIcon}</span>
      FEEL Validation: ${report.validCells}/${report.totalCells} valid
      ${hasErrors ? `<span style="color: var(--feel-error-color)">(${report.invalidCells} errors)</span>` : ''}
      ${hasWarnings ? `<span style="color: var(--feel-warning-color)">(${report.warnings} warnings)</span>` : ''}
    </div>
    ${hasErrors ? `
      <ul class="error-list">
        ${report.errors.map(e => `
          <li class="error-item" data-cell-id="${e.cellId}">
            <span class="error-icon">!</span>
            <span class="error-message">${escapeHtml(e.result.errors[0]?.message || 'Invalid expression')}</span>
            <span class="error-location">${e.isInputCell ? 'Input' : 'Output'}: ${escapeHtml(e.expression.substring(0, 30))}${e.expression.length > 30 ? '...' : ''}</span>
          </li>
        `).join('')}
      </ul>
    ` : ''}
  `;

  return panel;
}

/**
 * Create quick reference panel for FEEL syntax
 */
export function createQuickReferencePanel(): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'feel-quick-reference';

  panel.innerHTML = `
    <h4>FEEL Quick Reference</h4>

    <h5>Input Cell Expressions (Unary Tests)</h5>
    <table>
      <tr><th>Expression</th><th>Meaning</th></tr>
      <tr><td><code>&lt; 100</code></td><td>Less than 100</td></tr>
      <tr><td><code>&gt;= 18</code></td><td>Greater than or equal to 18</td></tr>
      <tr><td><code>[1..10]</code></td><td>Between 1 and 10 (inclusive)</td></tr>
      <tr><td><code>(0..100)</code></td><td>Between 0 and 100 (exclusive)</td></tr>
      <tr><td><code>"A", "B", "C"</code></td><td>One of these values</td></tr>
      <tr><td><code>not("rejected")</code></td><td>Not this value</td></tr>
      <tr><td><code>-</code></td><td>Any value (don't care)</td></tr>
      <tr><td><code>null</code></td><td>Null/empty value</td></tr>
    </table>

    <h5>Output Cell Expressions</h5>
    <table>
      <tr><th>Expression</th><th>Result</th></tr>
      <tr><td><code>"Approved"</code></td><td>String literal</td></tr>
      <tr><td><code>1500</code></td><td>Number</td></tr>
      <tr><td><code>true</code></td><td>Boolean</td></tr>
      <tr><td><code>date("2024-12-29")</code></td><td>Date value</td></tr>
      <tr><td><code>amount * 0.1</code></td><td>Calculation</td></tr>
    </table>

    <h5>Common Functions</h5>
    <table>
      <tr><th>Function</th><th>Description</th></tr>
      <tr><td><code>sum(list)</code></td><td>Sum of values</td></tr>
      <tr><td><code>count(list)</code></td><td>Number of items</td></tr>
      <tr><td><code>contains(str, match)</code></td><td>String contains</td></tr>
      <tr><td><code>upper case(str)</code></td><td>To uppercase</td></tr>
      <tr><td><code>date(str)</code></td><td>Parse date</td></tr>
      <tr><td><code>now()</code></td><td>Current datetime</td></tr>
    </table>
  `;

  return panel;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Export singleton instance
export const feelValidator = new FeelValidator();
