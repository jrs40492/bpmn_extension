/**
 * Decision Testing Panel for DMN Editor
 */

import { evaluateExpression, evaluateUnaryTest } from '../../extensions/feel-support/feel-service';

export interface InputDefinition {
  id: string;
  name: string;
  label: string;
  typeRef: string;
  expression?: string;
}

export interface OutputDefinition {
  id: string;
  name: string;
  label: string;
  typeRef: string;
}

export interface RuleDefinition {
  id: string;
  inputEntries: Array<{ id: string; text: string }>;
  outputEntries: Array<{ id: string; text: string }>;
  annotationEntries?: Array<{ text: string }>;
}

export interface DecisionTableDefinition {
  id: string;
  name: string;
  hitPolicy: string;
  inputs: InputDefinition[];
  outputs: OutputDefinition[];
  rules: RuleDefinition[];
}

export interface TestCase {
  id: string;
  name: string;
  inputs: Record<string, any>;
  expectedOutputs?: Record<string, any>;
  description?: string;
  created: string;
}

export interface TestResult {
  success: boolean;
  matchedRules: Array<{
    rule: RuleDefinition;
    ruleIndex: number;
    outputs: Record<string, any>;
    matched: boolean;
  }>;
  finalOutput: Record<string, any> | null;
  error?: string;
  executionPath?: string[];
  testCase?: TestCase;
}

export class DecisionTestingEngine {
  private decisionTable: DecisionTableDefinition | null = null;
  private testCases: TestCase[] = [];

  setDecisionTable(dt: DecisionTableDefinition): void {
    this.decisionTable = dt;
    this.loadTestCases();
  }

  // Test Case Management
  saveTestCase(name: string, inputs: Record<string, any>, expectedOutputs?: Record<string, any>, description?: string): TestCase {
    const testCase: TestCase = {
      id: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim() || `Test Case ${this.testCases.length + 1}`,
      inputs: { ...inputs },
      expectedOutputs: expectedOutputs ? { ...expectedOutputs } : undefined,
      description: description?.trim() || undefined,
      created: new Date().toISOString()
    };
    
    this.testCases.push(testCase);
    this.persistTestCases();
    return testCase;
  }

  getTestCases(): TestCase[] {
    return [...this.testCases];
  }

  deleteTestCase(id: string): boolean {
    const index = this.testCases.findIndex(tc => tc.id === id);
    if (index >= 0) {
      this.testCases.splice(index, 1);
      this.persistTestCases();
      return true;
    }
    return false;
  }

  runTestCase(testCase: TestCase): TestResult {
    const result = this.evaluate(testCase.inputs);
    return { ...result, testCase };
  }

  private getStorageKey(): string {
    return `dmn_test_cases_${this.decisionTable?.id || 'unknown'}`;
  }

  private loadTestCases(): void {
    try {
      const stored = localStorage.getItem(this.getStorageKey());
      if (stored) {
        this.testCases = JSON.parse(stored);
      } else {
        this.testCases = [];
      }
    } catch (err) {
      console.warn('[Testing] Failed to load test cases:', err);
      this.testCases = [];
    }
  }

  private persistTestCases(): void {
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(this.testCases));
    } catch (err) {
      console.warn('[Testing] Failed to persist test cases:', err);
    }
  }

  parseDecisionTable(dmnModeler: any): DecisionTableDefinition | null {
    try {
      const activeView = dmnModeler.getActiveView();
      if (!activeView || activeView.type !== 'decisionTable') {
        const views = dmnModeler.getViews();
        const dtView = views.find((v: any) => v.type === 'decisionTable');
        if (!dtView) return null;
      }

      const viewer = dmnModeler.getActiveViewer();
      if (!viewer) return null;

      const sheet = viewer.get('sheet');
      const root = sheet?.getRoot();
      
      if (!root || root.type !== 'dmn:DecisionTable') return null;

      const businessObject = root.businessObject;

      const inputs: InputDefinition[] = (businessObject.input || []).map((input: any) => ({
        id: input.id,
        name: input.inputVariable || input.id,
        label: input.label || input.id,
        typeRef: input.inputExpression?.typeRef || 'string',
        expression: input.inputExpression?.text
      }));

      const outputs: OutputDefinition[] = (businessObject.output || []).map((output: any) => ({
        id: output.id,
        name: output.name || output.id,
        label: output.label || output.name || output.id,
        typeRef: output.typeRef || 'string'
      }));

      const rules: RuleDefinition[] = (businessObject.rule || []).map((rule: any) => ({
        id: rule.id,
        inputEntries: (rule.inputEntry || []).map((entry: any) => ({
          id: entry.id,
          text: entry.text || '-'
        })),
        outputEntries: (rule.outputEntry || []).map((entry: any) => ({
          id: entry.id,
          text: entry.text || ''
        }))
      }));

      return {
        id: businessObject.id,
        name: businessObject.$parent?.name || 'Decision Table',
        hitPolicy: businessObject.hitPolicy || 'UNIQUE',
        inputs,
        outputs,
        rules
      };
    } catch (err) {
      console.error('[Decision Testing] Failed to parse decision table:', err);
      return null;
    }
  }

  evaluate(inputs: Record<string, any>): TestResult {
    if (!this.decisionTable) {
      return { success: false, matchedRules: [], finalOutput: null, error: 'No decision table loaded' };
    }

    const dt = this.decisionTable;
    const matchedRules: TestResult['matchedRules'] = [];

    try {
      for (let i = 0; i < dt.rules.length; i++) {
        const rule = dt.rules[i];
        let ruleMatches = true;

        for (let j = 0; j < rule.inputEntries.length; j++) {
          const entry = rule.inputEntries[j];
          const inputDef = dt.inputs[j];
          if (!inputDef) continue;

          const inputValue = inputs[inputDef.name] ?? inputs[inputDef.label] ?? inputs[inputDef.id];
          const condition = entry.text;

          if (!condition || condition.trim() === '-') continue;

          const result = evaluateUnaryTest(condition, inputValue, inputs);
          if (!result.success || !result.value) {
            ruleMatches = false;
            break;
          }
        }

        if (ruleMatches) {
          const outputs: Record<string, any> = {};
          for (let k = 0; k < rule.outputEntries.length; k++) {
            const entry = rule.outputEntries[k];
            const outputDef = dt.outputs[k];
            if (!outputDef) continue;

            const outputExpr = entry.text;
            if (outputExpr && outputExpr.trim() !== '') {
              const evalResult = evaluateExpression(outputExpr, inputs);
              outputs[outputDef.name || outputDef.label || outputDef.id] = 
                evalResult.success ? evalResult.value : outputExpr;
            }
          }

          matchedRules.push({ rule, ruleIndex: i + 1, outputs, matched: true });

          if (dt.hitPolicy === 'UNIQUE' || dt.hitPolicy === 'FIRST') break;
        }
      }

      const finalOutput = matchedRules.length > 0 ? matchedRules[0].outputs : null;
      return { success: true, matchedRules, finalOutput, executionPath: matchedRules.map(m => `Rule ${m.ruleIndex}`) };
    } catch (err) {
      return { success: false, matchedRules: [], finalOutput: null, error: err instanceof Error ? err.message : 'Evaluation failed' };
    }
  }
}

export function createTestingPanel(
  engine: DecisionTestingEngine,
  decisionTable: DecisionTableDefinition | null,
  onClose: () => void
): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'decision-test-panel';
  panel.id = 'decision-test-panel';

  if (!decisionTable) {
    panel.innerHTML = `
      <div class="decision-test-header">
        <h3><span class="icon">🧪</span> Decision Testing</h3>
        <button class="close-btn" title="Close">✕</button>
      </div>
      <div class="decision-test-body">
        <p style="text-align: center; color: var(--vscode-descriptionForeground); padding: 20px;">
          Open a decision table view to test it.<br><br>
          Click on a decision in the DRD to open its table.
        </p>
      </div>
    `;
    panel.querySelector('.close-btn')?.addEventListener('click', onClose);
    return panel;
  }

  engine.setDecisionTable(decisionTable);

  const inputFields = decisionTable.inputs.map(input => `
    <div class="test-input-row">
      <label class="test-input-label" title="${escapeHtml(input.expression || input.name)}">${escapeHtml(input.label)}</label>
      <input type="text" class="test-input-field" data-input-id="${input.id}" data-input-name="${input.name}" placeholder="Enter ${input.typeRef} value">
      <span class="test-input-type">${input.typeRef}</span>
    </div>
  `).join('');

  panel.innerHTML = `
    <div class="decision-test-header">
      <h3><span class="icon">🧪</span> Test: ${escapeHtml(decisionTable.name)}</h3>
      <div style="display: flex; gap: 8px; align-items: center;">
        <span class="hit-policy-badge" title="Hit Policy: ${decisionTable.hitPolicy}">${decisionTable.hitPolicy.charAt(0)}</span>
        <button class="close-btn" title="Close">✕</button>
      </div>
    </div>
    <div class="decision-test-body">
      <div class="decision-test-inputs">
        <h4>📥 Input Values</h4>
        ${inputFields || '<p style="color: var(--vscode-descriptionForeground);">No inputs defined</p>'}
      </div>
      <div class="decision-test-actions">
        <button class="test-btn test-btn-primary" id="btn-run-test">▶ Evaluate</button>
        <button class="test-btn test-btn-secondary" id="btn-clear-test">Clear</button>
        <button class="test-btn test-btn-secondary" id="btn-save-test">💾 Save Test</button>
        <button class="test-btn test-btn-secondary" id="btn-load-tests">📋 Test Cases</button>
      </div>
      <div class="decision-test-results" id="test-results" style="display: none;">
        <h4>📤 Results</h4>
        <div id="test-results-content"></div>
      </div>
    </div>
  `;

  panel.querySelector('.close-btn')?.addEventListener('click', onClose);
  
  panel.querySelector('#btn-run-test')?.addEventListener('click', () => {
    const inputs: Record<string, any> = {};
    panel.querySelectorAll('.test-input-field').forEach((field) => {
      const inputField = field as HTMLInputElement;
      const name = inputField.dataset.inputName || inputField.dataset.inputId;
      if (name) inputs[name] = parseInputValue(inputField.value.trim());
    });
    displayTestResults(panel, engine.evaluate(inputs));
  });

  panel.querySelector('#btn-clear-test')?.addEventListener('click', () => {
    panel.querySelectorAll('.test-input-field').forEach((field) => {
      (field as HTMLInputElement).value = '';
    });
    const resultsDiv = panel.querySelector('#test-results') as HTMLElement;
    if (resultsDiv) resultsDiv.style.display = 'none';
  });

  // Save test case
  panel.querySelector('#btn-save-test')?.addEventListener('click', () => {
    const inputs: Record<string, any> = {};
    panel.querySelectorAll('.test-input-field').forEach((field) => {
      const inputField = field as HTMLInputElement;
      const name = inputField.dataset.inputName || inputField.dataset.inputId;
      if (name && inputField.value.trim()) {
        inputs[name] = parseInputValue(inputField.value.trim());
      }
    });

    if (Object.keys(inputs).length === 0) {
      alert('Please enter some input values before saving a test case.');
      return;
    }

    const testName = prompt('Enter a name for this test case:');
    if (testName !== null) {
      const description = prompt('Enter an optional description:') || undefined;
      engine.saveTestCase(testName, inputs, undefined, description);
      showToast('Test case saved successfully!');
    }
  });

  // Load test cases
  panel.querySelector('#btn-load-tests')?.addEventListener('click', () => {
    showTestCasesDialog(engine, (testCase) => {
      // Load test case inputs into the form
      panel.querySelectorAll('.test-input-field').forEach((field) => {
        const inputField = field as HTMLInputElement;
        const name = inputField.dataset.inputName || inputField.dataset.inputId;
        if (name && testCase.inputs[name] !== undefined) {
          inputField.value = String(testCase.inputs[name]);
        } else {
          inputField.value = '';
        }
      });
      
      // Run the test case
      const result = engine.runTestCase(testCase);
      displayTestResults(panel, result);
      showToast(`Loaded and ran test case: ${testCase.name}`);
    });
  });

  return panel;
}

function parseInputValue(value: string): any {
  if (value === '' || value === 'null') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  const num = Number(value);
  if (!isNaN(num) && value !== '') return num;
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function displayTestResults(panel: HTMLElement, result: TestResult): void {
  const resultsDiv = panel.querySelector('#test-results') as HTMLElement;
  const contentDiv = panel.querySelector('#test-results-content') as HTMLElement;
  if (!resultsDiv || !contentDiv) return;

  resultsDiv.style.display = 'block';

  if (!result.success) {
    contentDiv.innerHTML = `<div class="test-result error"><div class="test-result-header"><span class="test-result-icon error">❌</span><span class="test-result-title">Evaluation Failed</span></div><div class="test-result-value">${escapeHtml(result.error || 'Unknown error')}</div></div>`;
    return;
  }

  if (result.matchedRules.length === 0) {
    contentDiv.innerHTML = `<div class="test-result warning"><div class="test-result-header"><span class="test-result-icon warning">⚠️</span><span class="test-result-title">No Rules Matched</span></div><p style="margin: 0; font-size: 12px;">No rules matched the given inputs.</p></div>`;
    return;
  }

  const outputHtml = result.finalOutput ? `<pre class="test-result-value">${escapeHtml(JSON.stringify(result.finalOutput, null, 2))}</pre>` : '<p>No output</p>';
  const matchedRulesHtml = result.matchedRules.map(m => `<div class="test-matched-rule"><span class="rule-id">Rule ${m.ruleIndex}</span><span>→ ${escapeHtml(JSON.stringify(m.outputs))}</span></div>`).join('');

  contentDiv.innerHTML = `<div class="test-result success"><div class="test-result-header"><span class="test-result-icon success">✅</span><span class="test-result-title">Output</span></div>${outputHtml}<div class="test-matched-rules"><p style="margin: 8px 0 4px 0; font-size: 11px;">Matched ${result.matchedRules.length} rule(s):</p>${matchedRulesHtml}</div></div>`;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Test Case Management Dialog
function showTestCasesDialog(engine: DecisionTestingEngine, onRunTestCase: (testCase: TestCase) => void): void {
  const testCases = engine.getTestCases();
  
  const dialog = document.createElement('div');
  dialog.className = 'test-cases-dialog-overlay';
  dialog.innerHTML = `
    <div class="test-cases-dialog">
      <div class="test-cases-header">
        <h3>📋 Test Cases</h3>
        <button class="test-cases-close-btn" title="Close">✕</button>
      </div>
      <div class="test-cases-body">
        ${testCases.length === 0 ? 
          '<p class="test-cases-empty">No saved test cases. Create some by saving your test inputs!</p>' : 
          testCases.map(tc => `
            <div class="test-case-item">
              <div class="test-case-header">
                <span class="test-case-name">${escapeHtml(tc.name)}</span>
                <span class="test-case-date">${new Date(tc.created).toLocaleDateString()}</span>
              </div>
              ${tc.description ? `<p class="test-case-description">${escapeHtml(tc.description)}</p>` : ''}
              <div class="test-case-inputs">
                <strong>Inputs:</strong> ${Object.entries(tc.inputs).map(([key, value]) => 
                  `${key}=${JSON.stringify(value)}`).join(', ')}
              </div>
              <div class="test-case-actions">
                <button class="test-case-btn test-case-run" data-test-id="${tc.id}">▶ Run</button>
                <button class="test-case-btn test-case-delete" data-test-id="${tc.id}">🗑️ Delete</button>
              </div>
            </div>
          `).join('')
        }
      </div>
    </div>
  `;

  // Event handlers
  dialog.querySelector('.test-cases-close-btn')?.addEventListener('click', () => {
    document.body.removeChild(dialog);
  });

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) {
      document.body.removeChild(dialog);
    }
  });

  // Run test case buttons
  dialog.querySelectorAll('.test-case-run').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const testId = (e.target as HTMLElement).dataset.testId;
      const testCase = testCases.find(tc => tc.id === testId);
      if (testCase) {
        onRunTestCase(testCase);
        document.body.removeChild(dialog);
      }
    });
  });

  // Delete test case buttons
  dialog.querySelectorAll('.test-case-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const testId = (e.target as HTMLElement).dataset.testId;
      const testCase = testCases.find(tc => tc.id === testId);
      if (testCase && testId && confirm(`Delete test case "${testCase.name}"?`)) {
        engine.deleteTestCase(testId);
        document.body.removeChild(dialog);
        showToast('Test case deleted');
      }
    });
  });

  document.body.appendChild(dialog);
}

// Toast notification system
function showToast(message: string, type: 'success' | 'warning' | 'error' = 'success'): void {
  const toast = document.createElement('div');
  toast.className = `test-toast test-toast-${type}`;
  toast.textContent = message;
  
  const icons = { success: '✅', warning: '⚠️', error: '❌' };
  toast.innerHTML = `<span class="test-toast-icon">${icons[type]}</span>${escapeHtml(message)}`;

  document.body.appendChild(toast);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    if (document.body.contains(toast)) {
      toast.style.opacity = '0';
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 300);
    }
  }, 3000);
}

export const decisionTestingEngine = new DecisionTestingEngine();
