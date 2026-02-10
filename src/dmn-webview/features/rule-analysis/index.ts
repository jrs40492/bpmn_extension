/**
 * Rule Analysis for DMN Decision Tables
 * 
 * Provides rule overlap detection, conflict analysis, and completeness checking
 */

import { DecisionTableDefinition, RuleDefinition, InputDefinition } from '../testing';
import { evaluateExpression, evaluateUnaryTest } from '../../extensions/feel-support/feel-service';

export interface RuleIssue {
  type: 'overlap' | 'conflict' | 'gap' | 'unreachable';
  severity: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  affectedRules: number[];
  suggestions?: string[];
  inputCombination?: Record<string, any>;
}

export interface RuleAnalysisResult {
  issues: RuleIssue[];
  totalRules: number;
  analyzedInputs: string[];
  completenessScore: number; // 0-100
  conflictCount: number;
  gapCount: number;
}

export class RuleAnalyzer {
  private decisionTable: DecisionTableDefinition | null = null;

  setDecisionTable(dt: DecisionTableDefinition): void {
    this.decisionTable = dt;
  }

  analyzeRules(): RuleAnalysisResult {
    if (!this.decisionTable) {
      return {
        issues: [],
        totalRules: 0,
        analyzedInputs: [],
        completenessScore: 0,
        conflictCount: 0,
        gapCount: 0
      };
    }

    const issues: RuleIssue[] = [];
    const dt = this.decisionTable;

    // Analyze rule overlaps and conflicts
    const overlapIssues = this.detectRuleOverlaps(dt);
    issues.push(...overlapIssues);

    // Analyze rule completeness (gaps)
    const completenessIssues = this.detectCompletenessGaps(dt);
    issues.push(...completenessIssues);

    // Analyze unreachable rules
    const unreachableIssues = this.detectUnreachableRules(dt);
    issues.push(...unreachableIssues);

    const conflictCount = issues.filter(i => i.type === 'overlap' || i.type === 'conflict').length;
    const gapCount = issues.filter(i => i.type === 'gap').length;
    const completenessScore = this.calculateCompletenessScore(dt, gapCount);

    return {
      issues,
      totalRules: dt.rules.length,
      analyzedInputs: dt.inputs.map(i => i.name),
      completenessScore,
      conflictCount,
      gapCount
    };
  }

  private detectRuleOverlaps(dt: DecisionTableDefinition): RuleIssue[] {
    const issues: RuleIssue[] = [];
    
    // Generate test cases for overlap detection
    const testCases = this.generateTestCases(dt);
    
    testCases.forEach(testCase => {
      const matchingRules = this.findMatchingRules(dt, testCase);
      
      if (matchingRules.length > 1) {
        // Check if outputs are different (conflict) or same (overlap)
        const outputs = matchingRules.map(ruleIndex => 
          this.evaluateRuleOutputs(dt.rules[ruleIndex], testCase, dt)
        );
        
        const hasConflict = this.hasConflictingOutputs(outputs);
        
        issues.push({
          type: hasConflict ? 'conflict' : 'overlap',
          severity: hasConflict ? 'error' : 'warning',
          title: hasConflict ? 
            'Rule Conflict Detected' : 
            'Rule Overlap Detected',
          description: hasConflict ?
            `Rules ${matchingRules.map(r => r + 1).join(', ')} produce different outputs for the same inputs, creating a conflict.` :
            `Rules ${matchingRules.map(r => r + 1).join(', ')} overlap for the same input combination.`,
          affectedRules: matchingRules,
          inputCombination: testCase,
          suggestions: hasConflict ? [
            'Review rule conditions to eliminate ambiguity',
            'Consider changing the hit policy to FIRST or UNIQUE',
            'Modify rule conditions to make them mutually exclusive'
          ] : [
            'Consider consolidating overlapping rules',
            'Review if multiple rules are necessary',
            'Ensure rule precedence is clear'
          ]
        });
      }
    });

    return issues;
  }

  private detectCompletenessGaps(dt: DecisionTableDefinition): RuleIssue[] {
    const issues: RuleIssue[] = [];
    
    // Analyze discrete input domains
    const inputDomains = this.analyzeInputDomains(dt);
    
    // Generate comprehensive test cases
    const comprehensiveTests = this.generateComprehensiveTestCases(dt, inputDomains);
    
    comprehensiveTests.forEach(testCase => {
      const matchingRules = this.findMatchingRules(dt, testCase);
      
      if (matchingRules.length === 0) {
        issues.push({
          type: 'gap',
          severity: 'warning',
          title: 'Rule Gap Detected',
          description: 'No rules cover this input combination, which may lead to unexpected behavior.',
          affectedRules: [],
          inputCombination: testCase,
          suggestions: [
            'Add a rule to handle this input combination',
            'Add a catch-all rule with "-" conditions',
            'Review if this input combination is valid in your business context'
          ]
        });
      }
    });

    return issues;
  }

  private detectUnreachableRules(dt: DecisionTableDefinition): RuleIssue[] {
    const issues: RuleIssue[] = [];
    
    // For each rule, try to find test cases that would match it exclusively
    dt.rules.forEach((rule, index) => {
      const canBeReached = this.canRuleBeReached(dt, index);
      
      if (!canBeReached) {
        issues.push({
          type: 'unreachable',
          severity: 'warning',
          title: 'Potentially Unreachable Rule',
          description: `Rule ${index + 1} may be unreachable due to other rules with broader conditions.`,
          affectedRules: [index],
          suggestions: [
            'Check if this rule is overshadowed by previous rules',
            'Consider reordering rules if using FIRST hit policy',
            'Review rule conditions for correctness'
          ]
        });
      }
    });

    return issues;
  }

  private generateTestCases(dt: DecisionTableDefinition): Array<Record<string, any>> {
    const testCases: Array<Record<string, any>> = [];
    
    // Extract values from existing rules
    const valuesByInput: Record<string, Set<any>> = {};
    
    dt.inputs.forEach(input => {
      valuesByInput[input.name] = new Set();
    });

    // Collect values from rule conditions
    dt.rules.forEach(rule => {
      rule.inputEntries.forEach((entry, inputIndex) => {
        const input = dt.inputs[inputIndex];
        if (input && entry.text && entry.text !== '-') {
          const extractedValues = this.extractValuesFromCondition(entry.text);
          extractedValues.forEach(value => valuesByInput[input.name].add(value));
        }
      });
    });

    // Generate combinations (limit to reasonable size)
    const inputNames = Object.keys(valuesByInput);
    const maxCombinations = 100; // Limit for performance
    let combinationCount = 0;

    const generateCombinations = (inputIndex: number, currentCase: Record<string, any>): void => {
      if (inputIndex >= inputNames.length) {
        testCases.push({ ...currentCase });
        combinationCount++;
        return;
      }
      
      if (combinationCount >= maxCombinations) return;
      
      const inputName = inputNames[inputIndex];
      const values = Array.from(valuesByInput[inputName]);
      
      if (values.length === 0) {
        // Add some default test values
        const defaultValues = [null, 0, 1, 100, '', 'test'];
        for (const value of defaultValues.slice(0, 3)) {
          currentCase[inputName] = value;
          generateCombinations(inputIndex + 1, currentCase);
          if (combinationCount >= maxCombinations) break;
        }
      } else {
        for (const value of values) {
          currentCase[inputName] = value;
          generateCombinations(inputIndex + 1, currentCase);
          if (combinationCount >= maxCombinations) break;
        }
      }
    };

    generateCombinations(0, {});
    return testCases;
  }

  private findMatchingRules(dt: DecisionTableDefinition, testCase: Record<string, any>): number[] {
    const matchingRules: number[] = [];

    dt.rules.forEach((rule, index) => {
      let ruleMatches = true;

      for (let j = 0; j < rule.inputEntries.length; j++) {
        const entry = rule.inputEntries[j];
        const inputDef = dt.inputs[j];
        if (!inputDef) continue;

        const inputValue = testCase[inputDef.name] ?? testCase[inputDef.label] ?? testCase[inputDef.id];
        const condition = entry.text;

        if (!condition || condition.trim() === '-') continue;

        try {
          const result = evaluateUnaryTest(condition, inputValue, testCase);
          if (!result.success || !result.value) {
            ruleMatches = false;
            break;
          }
        } catch {
          // If evaluation fails, assume no match
          ruleMatches = false;
          break;
        }
      }

      if (ruleMatches) {
        matchingRules.push(index);
      }
    });

    return matchingRules;
  }

  private evaluateRuleOutputs(rule: RuleDefinition, inputs: Record<string, any>, dt: DecisionTableDefinition): Record<string, any> {
    const outputs: Record<string, any> = {};
    
    rule.outputEntries.forEach((entry, index) => {
      const outputDef = dt.outputs[index];
      if (outputDef && entry.text) {
        try {
          const result = evaluateExpression(entry.text, inputs);
          outputs[outputDef.name] = result.success ? result.value : entry.text;
        } catch {
          outputs[outputDef.name] = entry.text;
        }
      }
    });

    return outputs;
  }

  private hasConflictingOutputs(outputs: Array<Record<string, any>>): boolean {
    if (outputs.length <= 1) return false;
    
    const firstOutput = outputs[0];
    return outputs.some(output => {
      return Object.keys(firstOutput).some(key => 
        JSON.stringify(firstOutput[key]) !== JSON.stringify(output[key])
      );
    });
  }

  private extractValuesFromCondition(condition: string): any[] {
    const values: any[] = [];
    
    // Extract string literals
    const stringMatches = condition.match(/"([^"]*)"/g);
    if (stringMatches) {
      stringMatches.forEach(match => values.push(match.slice(1, -1)));
    }

    // Extract numbers
    const numberMatches = condition.match(/-?\d+(?:\.\d+)?/g);
    if (numberMatches) {
      numberMatches.forEach(match => values.push(Number(match)));
    }

    // Extract boolean values
    if (condition.includes('true')) values.push(true);
    if (condition.includes('false')) values.push(false);

    return values;
  }

  private analyzeInputDomains(dt: DecisionTableDefinition): Record<string, any[]> {
    const domains: Record<string, any[]> = {};
    
    dt.inputs.forEach(input => {
      domains[input.name] = [];
      // Add type-based default values
      switch (input.typeRef?.toLowerCase()) {
        case 'boolean':
          domains[input.name] = [true, false];
          break;
        case 'number':
        case 'integer':
          domains[input.name] = [0, 1, -1, 100];
          break;
        case 'string':
          domains[input.name] = ['', 'test', 'value'];
          break;
        default:
          domains[input.name] = [null, '', 0, 1, true, false];
      }
    });

    return domains;
  }

  private generateComprehensiveTestCases(dt: DecisionTableDefinition, domains: Record<string, any[]>): Array<Record<string, any>> {
    // Generate a reasonable sample of test cases
    const testCases: Array<Record<string, any>> = [];
    const inputNames = Object.keys(domains);
    const maxCases = 50; // Limit for performance

    for (let i = 0; i < maxCases && i < Math.pow(2, inputNames.length); i++) {
      const testCase: Record<string, any> = {};
      inputNames.forEach((name, index) => {
        const domain = domains[name];
        const valueIndex = Math.floor(Math.random() * domain.length);
        testCase[name] = domain[valueIndex];
      });
      testCases.push(testCase);
    }

    return testCases;
  }

  private canRuleBeReached(dt: DecisionTableDefinition, ruleIndex: number): boolean {
    // Simple heuristic: try to generate test cases that match this rule
    const rule = dt.rules[ruleIndex];
    const testCase: Record<string, any> = {};

    // Try to satisfy each input condition
    rule.inputEntries.forEach((entry, inputIndex) => {
      const input = dt.inputs[inputIndex];
      if (!input) return;

      if (!entry.text || entry.text.trim() === '-') {
        // Any value works
        testCase[input.name] = 'test';
      } else {
        // Try to find a value that satisfies the condition
        const possibleValues = this.extractValuesFromCondition(entry.text);
        if (possibleValues.length > 0) {
          testCase[input.name] = possibleValues[0];
        } else {
          // Try some default values
          const defaults = [true, false, 0, 1, '', 'test'];
          for (const defaultValue of defaults) {
            try {
              const result = evaluateUnaryTest(entry.text, defaultValue, {});
              if (result.success && result.value) {
                testCase[input.name] = defaultValue;
                break;
              }
            } catch {
              continue;
            }
          }
        }
      }
    });

    // Check if this test case matches the rule
    const matchingRules = this.findMatchingRules(dt, testCase);
    return matchingRules.includes(ruleIndex);
  }

  private calculateCompletenessScore(dt: DecisionTableDefinition, gapCount: number): number {
    if (dt.inputs.length === 0) return 100;
    
    // Simple heuristic based on rule coverage
    const expectedCoverage = Math.pow(2, Math.min(dt.inputs.length, 4)); // Reasonable expectation
    const actualCoverage = Math.max(1, dt.rules.length);
    const gapPenalty = gapCount * 5; // 5 points per gap
    
    const score = Math.max(0, Math.min(100, 
      (actualCoverage / expectedCoverage) * 100 - gapPenalty
    ));
    
    return Math.round(score);
  }
}

export function createRuleAnalysisPanel(
  analyzer: RuleAnalyzer,
  decisionTable: DecisionTableDefinition | null,
  onClose: () => void
): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'rule-analysis-panel';
  panel.id = 'rule-analysis-panel';

  if (!decisionTable) {
    panel.innerHTML = `
      <div class="rule-analysis-header">
        <h3><span class="icon">🔍</span> Rule Analysis</h3>
        <button class="rule-analysis-close-btn" title="Close">✕</button>
      </div>
      <div class="rule-analysis-body">
        <p style="text-align: center; color: var(--vscode-descriptionForeground); padding: 20px;">
          Open a decision table view to analyze its rules.<br><br>
          Click on a decision in the DRD to open its table.
        </p>
      </div>
    `;
    panel.querySelector('.rule-analysis-close-btn')?.addEventListener('click', onClose);
    return panel;
  }

  analyzer.setDecisionTable(decisionTable);
  const analysisResult = analyzer.analyzeRules();

  const severityIcons = {
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  const typeIcons = {
    conflict: '⚡',
    overlap: '🔄',
    gap: '🕳️',
    unreachable: '🚫'
  };

  const issuesByType = analysisResult.issues.reduce((acc, issue) => {
    if (!acc[issue.type]) acc[issue.type] = [];
    acc[issue.type].push(issue);
    return acc;
  }, {} as Record<string, RuleIssue[]>);

  panel.innerHTML = `
    <div class="rule-analysis-header">
      <h3><span class="icon">🔍</span> Rule Analysis: ${escapeHtml(decisionTable.name)}</h3>
      <div style="display: flex; gap: 8px; align-items: center;">
        <span class="completeness-score ${analysisResult.completenessScore >= 80 ? 'good' : analysisResult.completenessScore >= 60 ? 'moderate' : 'poor'}">
          ${analysisResult.completenessScore}%
        </span>
        <button class="rule-analysis-refresh-btn" title="Refresh Analysis">🔄</button>
        <button class="rule-analysis-close-btn" title="Close">✕</button>
      </div>
    </div>
    <div class="rule-analysis-body">
      <div class="analysis-summary">
        <div class="summary-metrics">
          <div class="metric-item">
            <span class="metric-value">${analysisResult.totalRules}</span>
            <span class="metric-label">Rules</span>
          </div>
          <div class="metric-item">
            <span class="metric-value ${analysisResult.conflictCount > 0 ? 'error' : 'good'}">${analysisResult.conflictCount}</span>
            <span class="metric-label">Conflicts</span>
          </div>
          <div class="metric-item">
            <span class="metric-value ${analysisResult.gapCount > 0 ? 'warning' : 'good'}">${analysisResult.gapCount}</span>
            <span class="metric-label">Gaps</span>
          </div>
          <div class="metric-item">
            <span class="metric-value ${analysisResult.issues.length > 0 ? 'warning' : 'good'}">${analysisResult.issues.length}</span>
            <span class="metric-label">Issues</span>
          </div>
        </div>
      </div>

      ${analysisResult.issues.length === 0 ? 
        '<div class="analysis-success"><div class="success-icon">✅</div><h4>Great! No issues found</h4><p>Your decision table appears to have good rule coverage without conflicts or gaps.</p></div>' :
        `<div class="analysis-issues">
          <h4>📋 Issues Found (${analysisResult.issues.length})</h4>
          ${Object.entries(issuesByType).map(([type, issues]) => `
            <div class="issue-category">
              <div class="issue-category-header">
                <span class="issue-type-icon">${typeIcons[type as keyof typeof typeIcons]}</span>
                <span class="issue-type-name">${type.charAt(0).toUpperCase() + type.slice(1)} Issues</span>
                <span class="issue-count">${issues.length}</span>
              </div>
              <div class="issue-category-items">
                ${issues.map((issue, index) => `
                  <div class="issue-item severity-${issue.severity}">
                    <div class="issue-header">
                      <span class="issue-severity-icon">${severityIcons[issue.severity]}</span>
                      <span class="issue-title">${escapeHtml(issue.title)}</span>
                      ${issue.affectedRules.length > 0 ? 
                        `<span class="affected-rules">Rules: ${issue.affectedRules.map(r => r + 1).join(', ')}</span>` : 
                        ''}
                    </div>
                    <div class="issue-description">${escapeHtml(issue.description)}</div>
                    ${issue.inputCombination ? 
                      `<div class="issue-inputs">
                        <strong>Input combination:</strong>
                        <code>${Object.entries(issue.inputCombination).map(([key, value]) => 
                          `${key}=${JSON.stringify(value)}`).join(', ')}</code>
                      </div>` : ''}
                    ${issue.suggestions && issue.suggestions.length > 0 ? 
                      `<div class="issue-suggestions">
                        <strong>Suggestions:</strong>
                        <ul>${issue.suggestions.map(suggestion => 
                          `<li>${escapeHtml(suggestion)}</li>`).join('')}</ul>
                      </div>` : ''}
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>`
      }
    </div>
  `;

  // Event handlers
  panel.querySelector('.rule-analysis-close-btn')?.addEventListener('click', onClose);
  
  panel.querySelector('.rule-analysis-refresh-btn')?.addEventListener('click', () => {
    // Re-run analysis and refresh the panel
    const refreshedResult = analyzer.analyzeRules();
    const newPanel = createRuleAnalysisPanel(analyzer, decisionTable, onClose);
    panel.parentNode?.replaceChild(newPanel, panel);
  });

  return panel;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export const ruleAnalyzer = new RuleAnalyzer();