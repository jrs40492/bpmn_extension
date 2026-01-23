/**
 * BPMN Compliance Levels
 * Support different BPMN 2.0 compliance levels with comprehensive validation
 */

import type { DmnFileInfo } from '../../../shared/message-types';

export type ComplianceLevel =
  | 'descriptive'      // Basic modeling, documentation only
  | 'analytic'         // Process analysis and simulation
  | 'common-executable' // Executable with common elements
  | 'full';            // Full BPMN 2.0 specification

export interface ComplianceRule {
  id: string;
  level: ComplianceLevel;
  description: string;
  allowedElements?: string[];
  disallowedElements?: string[];
  validate: (elements: unknown[]) => ComplianceViolation[];
}

export interface ComplianceViolation {
  elementId: string;
  elementType: string;
  rule: string;
  message: string;
  severity: 'error' | 'warning';
  category?: 'compliance' | 'lint' | 'dmn' | 'xml' | 'task';
}

// Lint issue format from bpmn-js-bpmnlint
export interface LintIssue {
  id: string;
  message: string;
  category: 'error' | 'warn';
  rule: string;
}

// Element categories by compliance level
const DESCRIPTIVE_ELEMENTS = [
  'bpmn:Process',
  'bpmn:StartEvent',
  'bpmn:EndEvent',
  'bpmn:Task',
  'bpmn:UserTask',
  'bpmn:ServiceTask',
  'bpmn:ManualTask',
  'bpmn:ExclusiveGateway',
  'bpmn:ParallelGateway',
  'bpmn:SequenceFlow',
  'bpmn:TextAnnotation',
  'bpmn:Association',
  'bpmn:Lane',
  'bpmn:Participant'
];

const ANALYTIC_ELEMENTS = [
  ...DESCRIPTIVE_ELEMENTS,
  'bpmn:InclusiveGateway',
  'bpmn:EventBasedGateway',
  'bpmn:IntermediateCatchEvent',
  'bpmn:IntermediateThrowEvent',
  'bpmn:BoundaryEvent',
  'bpmn:SubProcess',
  'bpmn:CallActivity',
  'bpmn:DataObject',
  'bpmn:DataStore',
  'bpmn:MessageFlow',
  'bpmn:Group'
];

const COMMON_EXECUTABLE_ELEMENTS = [
  ...ANALYTIC_ELEMENTS,
  'bpmn:ScriptTask',
  'bpmn:BusinessRuleTask',
  'bpmn:SendTask',
  'bpmn:ReceiveTask',
  'bpmn:TimerEventDefinition',
  'bpmn:MessageEventDefinition',
  'bpmn:ErrorEventDefinition',
  'bpmn:SignalEventDefinition',
  'bpmn:TerminateEventDefinition'
];

// All BPMN 2.0 elements allowed in full compliance
const FULL_ELEMENTS = [
  ...COMMON_EXECUTABLE_ELEMENTS,
  'bpmn:ComplexGateway',
  'bpmn:Transaction',
  'bpmn:AdHocSubProcess',
  'bpmn:CompensateEventDefinition',
  'bpmn:ConditionalEventDefinition',
  'bpmn:EscalationEventDefinition',
  'bpmn:CancelEventDefinition',
  'bpmn:LinkEventDefinition',
  'bpmn:MultiInstanceLoopCharacteristics',
  'bpmn:StandardLoopCharacteristics',
  'bpmn:Choreography',
  'bpmn:Collaboration',
  'bpmn:Conversation'
];

const LEVEL_ELEMENTS: Record<ComplianceLevel, string[]> = {
  'descriptive': DESCRIPTIVE_ELEMENTS,
  'analytic': ANALYTIC_ELEMENTS,
  'common-executable': COMMON_EXECUTABLE_ELEMENTS,
  'full': FULL_ELEMENTS
};

const LEVEL_NAMES: Record<ComplianceLevel, string> = {
  'descriptive': 'Descriptive (Basic)',
  'analytic': 'Analytic (Analysis)',
  'common-executable': 'Common Executable',
  'full': 'Full BPMN 2.0'
};

const LEVEL_DESCRIPTIONS: Record<ComplianceLevel, string> = {
  'descriptive': 'Basic process documentation with simple flows',
  'analytic': 'Process analysis with intermediate events and data',
  'common-executable': 'Executable processes with common automation elements',
  'full': 'Complete BPMN 2.0 specification support'
};

let currentLevel: ComplianceLevel = 'full';
let storedLintIssues: Record<string, LintIssue[]> = {};
let storedDmnFiles: DmnFileInfo[] = [];

/**
 * Store lint issues for later use in validation
 */
export function setLintIssues(issues: Record<string, LintIssue[]>): void {
  storedLintIssues = issues;
}

/**
 * Store DMN files for DMN reference validation
 */
export function setDmnFilesForCompliance(files: DmnFileInfo[]): void {
  storedDmnFiles = files;
}

export function initCompliancePanel(
  getElements: () => unknown[],
  onLevelChange?: (level: ComplianceLevel) => void,
  triggerLint?: () => void | Promise<void>
): {
  show: () => void;
  hide: () => void;
  setLevel: (level: ComplianceLevel) => void;
  getLevel: () => ComplianceLevel;
  validate: () => ComplianceViolation[];
  setLintIssues: (issues: Record<string, LintIssue[]>) => void;
  setDmnFiles: (files: DmnFileInfo[]) => void;
} {
  const panel = createCompliancePanelHTML();
  document.body.appendChild(panel);

  const closeButton = panel.querySelector('.compliance-panel-close') as HTMLButtonElement;
  const levelSelect = panel.querySelector('#compliance-level') as HTMLSelectElement;
  const validateBtn = panel.querySelector('#validate-compliance-btn') as HTMLButtonElement;
  const resultsDiv = panel.querySelector('.compliance-results') as HTMLDivElement;
  const allowedList = panel.querySelector('.allowed-elements-list') as HTMLDivElement;

  // Set initial level
  levelSelect.value = currentLevel;
  updateAllowedElements();

  closeButton.addEventListener('click', () => {
    panel.classList.remove('visible');
  });

  levelSelect.addEventListener('change', () => {
    currentLevel = levelSelect.value as ComplianceLevel;
    updateAllowedElements();
    onLevelChange?.(currentLevel);
  });

  validateBtn.addEventListener('click', async () => {
    // Show loading state
    resultsDiv.innerHTML = '<div class="compliance-loading">Validating...</div>';

    // Trigger linting and wait for it to complete
    if (triggerLint) {
      try {
        await triggerLint();
      } catch (err) {
        console.error('[BAMOE Compliance] Linting error:', err);
      }
    }

    // Now run full validation with the updated lint issues
    const violations = runFullValidation(getElements(), currentLevel);
    renderViolations(violations, resultsDiv);
  });

  function updateAllowedElements() {
    const elements = LEVEL_ELEMENTS[currentLevel];
    const grouped = groupElementsByCategory(elements);

    allowedList.innerHTML = Object.entries(grouped).map(([category, items]) => `
      <div class="element-category">
        <div class="element-category-name">${category}</div>
        <div class="element-tags">
          ${items.map(el => `<span class="element-tag">${formatElementName(el)}</span>`).join('')}
        </div>
      </div>
    `).join('');
  }

  function show() {
    panel.classList.add('visible');
  }

  function hide() {
    panel.classList.remove('visible');
  }

  function validate(): ComplianceViolation[] {
    return runFullValidation(getElements(), currentLevel);
  }

  return {
    show,
    hide,
    setLevel: (level: ComplianceLevel) => {
      currentLevel = level;
      levelSelect.value = level;
      updateAllowedElements();
    },
    getLevel: () => currentLevel,
    validate,
    setLintIssues: (issues: Record<string, LintIssue[]>) => {
      storedLintIssues = issues;
    },
    setDmnFiles: (files: DmnFileInfo[]) => {
      storedDmnFiles = files;
    }
  };
}

/**
 * Run full validation including all validation types
 */
function runFullValidation(elements: unknown[], level: ComplianceLevel): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];

  // 1. Compliance level validation
  violations.push(...validateCompliance(elements, level));

  // 2. Lint issues (bpmnlint)
  violations.push(...convertLintIssuesToViolations(storedLintIssues));

  // 3. DMN reference validation
  violations.push(...validateDmnReferences(elements, storedDmnFiles));

  // 4. XML structure validation
  violations.push(...validateXmlStructure(elements));

  // 5. Task-specific validation
  violations.push(...validateTasks(elements));

  return violations;
}

/**
 * Validate compliance level restrictions
 */
function validateCompliance(elements: unknown[], level: ComplianceLevel): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];
  const allowedElements = LEVEL_ELEMENTS[level];

  for (const element of elements) {
    const el = element as { id: string; type: string; businessObject?: { $type: string; name?: string } };

    if (!el.businessObject) continue;

    const type = el.businessObject.$type;

    // Skip diagram elements
    if (type.startsWith('bpmndi:')) continue;

    // Check if element type is allowed at this compliance level
    if (!allowedElements.includes(type) && !type.includes('Flow') && !type.includes('Definition')) {
      violations.push({
        elementId: el.id,
        elementType: type,
        rule: 'element-not-allowed',
        message: `${formatElementName(type)} is not allowed at ${LEVEL_NAMES[level]} compliance level`,
        severity: 'error',
        category: 'compliance'
      });
    }
  }

  // Add level-specific validations
  if (level === 'common-executable' || level === 'full') {
    // Check for executable process requirements
    const processes = elements.filter((el: unknown) => {
      const e = el as { businessObject?: { $type: string } };
      return e.businessObject?.$type === 'bpmn:Process';
    });

    for (const proc of processes) {
      const p = proc as { id: string; businessObject: { isExecutable?: boolean } };
      if (!p.businessObject.isExecutable) {
        violations.push({
          elementId: p.id,
          elementType: 'bpmn:Process',
          rule: 'process-not-executable',
          message: 'Process should be marked as executable for this compliance level',
          severity: 'warning',
          category: 'compliance'
        });
      }
    }
  }

  return violations;
}

/**
 * Convert lint issues from bpmnlint to compliance violations
 */
function convertLintIssuesToViolations(lintIssues: Record<string, LintIssue[]>): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];

  for (const [elementId, issues] of Object.entries(lintIssues)) {
    for (const issue of issues) {
      violations.push({
        elementId: elementId,
        elementType: 'unknown',
        rule: issue.rule,
        message: issue.message,
        severity: issue.category === 'error' ? 'error' : 'warning',
        category: 'lint'
      });
    }
  }

  return violations;
}

/**
 * Validate DMN references in Business Rule Tasks
 */
function validateDmnReferences(elements: unknown[], dmnFiles: DmnFileInfo[]): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];

  for (const element of elements) {
    const el = element as {
      id: string;
      businessObject?: {
        $type: string;
        name?: string;
        dataInputAssociations?: Array<{
          targetRef?: { name?: string };
          assignment?: Array<{
            from?: { body?: string };
          }>;
        }>;
      };
    };

    if (!el.businessObject || el.businessObject.$type !== 'bpmn:BusinessRuleTask') {
      continue;
    }

    const elementId = el.id;
    const elementName = el.businessObject.name || elementId;

    // Get DMN reference values from data input associations
    const associations = el.businessObject.dataInputAssociations || [];
    let modelValue = '';
    let namespaceValue = '';
    let decisionValue = '';

    for (const assoc of associations) {
      const inputName = assoc.targetRef?.name;
      const value = assoc.assignment?.[0]?.from?.body || '';

      if (inputName === 'model') modelValue = value;
      if (inputName === 'namespace') namespaceValue = value;
      if (inputName === 'decision') decisionValue = value;
    }

    // Skip validation if no DMN model is configured yet
    if (!modelValue && !namespaceValue) {
      continue;
    }

    // Check if model is specified
    if (!modelValue) {
      violations.push({
        elementId,
        elementType: 'bpmn:BusinessRuleTask',
        rule: 'dmn-model-required',
        message: `Business Rule Task "${elementName}" has a namespace but no DMN model specified`,
        severity: 'error',
        category: 'dmn'
      });
      continue;
    }

    // Find matching DMN file by model name
    const matchingFile = dmnFiles.find(f => {
      if (f.modelName && f.modelName === modelValue) return true;
      const fileNameWithoutExt = f.name.replace(/\.dmn$/i, '');
      if (fileNameWithoutExt === modelValue) return true;
      return false;
    });

    if (!matchingFile) {
      const availableModels = dmnFiles
        .map(f => f.modelName || f.name.replace(/\.dmn$/i, ''))
        .filter(Boolean);

      let message = `Business Rule Task "${elementName}" references DMN model "${modelValue}" which does not exist`;
      if (availableModels.length > 0) {
        message += `. Available models: ${availableModels.join(', ')}`;
      } else {
        message += '. No DMN files found in the workspace';
      }

      violations.push({
        elementId,
        elementType: 'bpmn:BusinessRuleTask',
        rule: 'dmn-model-not-found',
        message,
        severity: 'error',
        category: 'dmn'
      });
      continue;
    }

    // Validate namespace matches
    if (namespaceValue && matchingFile.namespace && namespaceValue !== matchingFile.namespace) {
      violations.push({
        elementId,
        elementType: 'bpmn:BusinessRuleTask',
        rule: 'dmn-namespace-mismatch',
        message: `Business Rule Task "${elementName}" has namespace "${namespaceValue}" but DMN file "${matchingFile.name}" has namespace "${matchingFile.namespace}"`,
        severity: 'error',
        category: 'dmn'
      });
    }

    // Validate decision exists in the DMN file
    if (decisionValue) {
      const decisionExists = matchingFile.decisions.some(d => d.id === decisionValue);
      if (!decisionExists) {
        const availableDecisions = matchingFile.decisions.map(d => d.id).join(', ');
        violations.push({
          elementId,
          elementType: 'bpmn:BusinessRuleTask',
          rule: 'dmn-decision-not-found',
          message: `Business Rule Task "${elementName}" references decision "${decisionValue}" which does not exist. Available: ${availableDecisions || 'none'}`,
          severity: 'error',
          category: 'dmn'
        });
      }
    } else if (matchingFile.decisions.length > 0) {
      violations.push({
        elementId,
        elementType: 'bpmn:BusinessRuleTask',
        rule: 'dmn-decision-not-specified',
        message: `Business Rule Task "${elementName}" does not specify which decision to invoke from DMN model "${modelValue}"`,
        severity: 'warning',
        category: 'dmn'
      });
    }
  }

  return violations;
}

/**
 * Validate XML structure issues that would be fixed on export
 */
function validateXmlStructure(elements: unknown[]): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];

  for (const element of elements) {
    const el = element as {
      id: string;
      businessObject?: {
        $type: string;
        name?: string;
        ioSpecification?: {
          dataInputs?: Array<{ id: string; name?: string }>;
          dataOutputs?: Array<{ id: string; name?: string }>;
        };
        dataInputAssociations?: Array<{
          sourceRef?: unknown[];
          targetRef?: { id?: string };
        }>;
        dataOutputAssociations?: Array<{
          sourceRef?: unknown[];
          targetRef?: { id?: string };
        }>;
      };
    };

    if (!el.businessObject) continue;
    const bo = el.businessObject;

    // Check for incomplete DataOutputAssociations (missing targetRef)
    const outputAssocs = bo.dataOutputAssociations || [];
    for (const assoc of outputAssocs) {
      if (assoc.sourceRef && assoc.sourceRef.length > 0 && !assoc.targetRef) {
        violations.push({
          elementId: el.id,
          elementType: bo.$type,
          rule: 'data-output-missing-target',
          message: 'Data output association is missing targetRef (process variable). This will be auto-fixed on export.',
          severity: 'warning',
          category: 'xml'
        });
      }
    }

    // Check for incomplete DataInputAssociations (missing sourceRef)
    const inputAssocs = bo.dataInputAssociations || [];
    for (const assoc of inputAssocs) {
      if (assoc.targetRef && (!assoc.sourceRef || assoc.sourceRef.length === 0)) {
        // Only warn if there's no assignment (which is an alternative mapping method)
        const assocAny = assoc as { assignment?: unknown[] };
        if (!assocAny.assignment || assocAny.assignment.length === 0) {
          violations.push({
            elementId: el.id,
            elementType: bo.$type,
            rule: 'data-input-missing-source',
            message: 'Data input association is missing sourceRef (process variable or assignment).',
            severity: 'warning',
            category: 'xml'
          });
        }
      }
    }
  }

  return violations;
}

/**
 * Validate task-specific requirements
 */
function validateTasks(elements: unknown[]): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];

  for (const element of elements) {
    const el = element as {
      id: string;
      businessObject?: {
        $type: string;
        name?: string;
        script?: string;
        scriptFormat?: string;
        implementation?: string;
        dataInputAssociations?: Array<{
          targetRef?: { name?: string };
          assignment?: Array<{
            from?: { body?: string };
          }>;
        }>;
        eventDefinitions?: Array<{
          $type: string;
          timeDuration?: { body?: string };
          timeDate?: { body?: string };
          timeCycle?: { body?: string };
        }>;
      };
    };

    if (!el.businessObject) continue;
    const bo = el.businessObject;
    const elementName = bo.name || el.id;

    // Validate Script Tasks
    if (bo.$type === 'bpmn:ScriptTask') {
      if (!bo.script || bo.script.trim() === '') {
        violations.push({
          elementId: el.id,
          elementType: bo.$type,
          rule: 'script-task-empty',
          message: `Script Task "${elementName}" has no script content defined`,
          severity: 'error',
          category: 'task'
        });
      }

      if (!bo.scriptFormat) {
        violations.push({
          elementId: el.id,
          elementType: bo.$type,
          rule: 'script-task-no-language',
          message: `Script Task "${elementName}" has no script language specified`,
          severity: 'warning',
          category: 'task'
        });
      }
    }

    // Validate Service Tasks with REST implementation
    if (bo.$type === 'bpmn:ServiceTask' || (bo.$type === 'bpmn:Task' && bo.implementation)) {
      const associations = bo.dataInputAssociations || [];
      let urlValue = '';
      let methodValue = '';

      for (const assoc of associations) {
        const inputName = assoc.targetRef?.name;
        const value = assoc.assignment?.[0]?.from?.body || '';

        if (inputName === 'Url') urlValue = value;
        if (inputName === 'Method') methodValue = value;
      }

      // Check for REST task configuration (has URL or Method inputs)
      if (urlValue || methodValue) {
        if (!urlValue) {
          violations.push({
            elementId: el.id,
            elementType: bo.$type,
            rule: 'rest-task-no-url',
            message: `REST Task "${elementName}" has no URL specified`,
            severity: 'error',
            category: 'task'
          });
        } else {
          // Validate URL format (basic check)
          const urlPattern = /^(https?:\/\/|\{|\$\{)/i;
          if (!urlPattern.test(urlValue)) {
            violations.push({
              elementId: el.id,
              elementType: bo.$type,
              rule: 'rest-task-invalid-url',
              message: `REST Task "${elementName}" has an invalid URL format: "${urlValue}"`,
              severity: 'warning',
              category: 'task'
            });
          }
        }

        if (!methodValue) {
          violations.push({
            elementId: el.id,
            elementType: bo.$type,
            rule: 'rest-task-no-method',
            message: `REST Task "${elementName}" has no HTTP method specified`,
            severity: 'warning',
            category: 'task'
          });
        }
      }
    }

    // Validate Timer Events
    if (bo.eventDefinitions) {
      for (const eventDef of bo.eventDefinitions) {
        if (eventDef.$type === 'bpmn:TimerEventDefinition') {
          const hasTimerConfig = eventDef.timeDuration || eventDef.timeDate || eventDef.timeCycle;

          if (!hasTimerConfig) {
            violations.push({
              elementId: el.id,
              elementType: 'bpmn:TimerEventDefinition',
              rule: 'timer-event-no-config',
              message: `Timer Event "${elementName}" has no duration, date, or cycle defined`,
              severity: 'error',
              category: 'task'
            });
          } else {
            // Validate ISO 8601 duration format for timeDuration
            if (eventDef.timeDuration?.body) {
              const durationValue = eventDef.timeDuration.body;
              // Basic ISO 8601 duration pattern: P[nY][nM][nD][T[nH][nM][nS]]
              const iso8601DurationPattern = /^P(?:\d+Y)?(?:\d+M)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?)?$/;
              // Also allow expression patterns like ${expression}
              const expressionPattern = /^\$\{.+\}$/;

              if (!iso8601DurationPattern.test(durationValue) && !expressionPattern.test(durationValue)) {
                violations.push({
                  elementId: el.id,
                  elementType: 'bpmn:TimerEventDefinition',
                  rule: 'timer-event-invalid-duration',
                  message: `Timer Event "${elementName}" has an invalid duration format: "${durationValue}". Expected ISO 8601 format (e.g., PT1H, P1D, PT30M)`,
                  severity: 'warning',
                  category: 'task'
                });
              }
            }

            // Validate timeCycle format (ISO 8601 repeating or cron)
            if (eventDef.timeCycle?.body) {
              const cycleValue = eventDef.timeCycle.body;
              // ISO 8601 repeating: R/start/duration or R[n]/duration
              const iso8601CyclePattern = /^R(\d+)?\/.*$/;
              // Cron expression pattern (basic validation)
              const cronPattern = /^[\d*/,-]+\s+[\d*/,-]+\s+[\d*/,-]+\s+[\d*/,-]+\s+[\d*/,-]+/;
              const expressionPattern = /^\$\{.+\}$/;

              if (!iso8601CyclePattern.test(cycleValue) &&
                  !cronPattern.test(cycleValue) &&
                  !expressionPattern.test(cycleValue)) {
                violations.push({
                  elementId: el.id,
                  elementType: 'bpmn:TimerEventDefinition',
                  rule: 'timer-event-invalid-cycle',
                  message: `Timer Event "${elementName}" has an invalid cycle format: "${cycleValue}"`,
                  severity: 'warning',
                  category: 'task'
                });
              }
            }
          }
        }

        // Validate Message Events
        if (eventDef.$type === 'bpmn:MessageEventDefinition') {
          const msgEventDef = eventDef as { messageRef?: { id?: string; name?: string } };
          if (!msgEventDef.messageRef) {
            violations.push({
              elementId: el.id,
              elementType: 'bpmn:MessageEventDefinition',
              rule: 'message-event-no-ref',
              message: `Message Event "${elementName}" has no message definition reference`,
              severity: 'warning',
              category: 'task'
            });
          }
        }
      }
    }
  }

  return violations;
}

function groupElementsByCategory(elements: string[]): Record<string, string[]> {
  const categories: Record<string, string[]> = {
    'Events': [],
    'Tasks': [],
    'Gateways': [],
    'Containers': [],
    'Data': [],
    'Connectors': [],
    'Other': []
  };

  for (const el of elements) {
    if (el.includes('Event')) {
      categories['Events'].push(el);
    } else if (el.includes('Task')) {
      categories['Tasks'].push(el);
    } else if (el.includes('Gateway')) {
      categories['Gateways'].push(el);
    } else if (el.includes('Process') || el.includes('SubProcess') || el.includes('Lane') || el.includes('Participant')) {
      categories['Containers'].push(el);
    } else if (el.includes('Data') || el.includes('Store')) {
      categories['Data'].push(el);
    } else if (el.includes('Flow') || el.includes('Association')) {
      categories['Connectors'].push(el);
    } else {
      categories['Other'].push(el);
    }
  }

  // Remove empty categories
  return Object.fromEntries(
    Object.entries(categories).filter(([, items]) => items.length > 0)
  );
}

function formatElementName(type: string): string {
  return type
    .replace('bpmn:', '')
    .replace(/([A-Z])/g, ' $1')
    .trim();
}

const CATEGORY_ICONS: Record<string, string> = {
  'compliance': '📋',
  'lint': '🔍',
  'dmn': '📊',
  'xml': '📄',
  'task': '⚙️'
};

const CATEGORY_NAMES: Record<string, string> = {
  'compliance': 'Compliance Level',
  'lint': 'BPMN Lint Rules',
  'dmn': 'DMN References',
  'xml': 'XML Structure',
  'task': 'Task Configuration'
};

function renderViolations(violations: ComplianceViolation[], container: HTMLDivElement): void {
  if (violations.length === 0) {
    container.innerHTML = `
      <div class="compliance-success">
        <span class="compliance-icon">✅</span>
        <span>Diagram is compliant with ${LEVEL_NAMES[currentLevel]} level</span>
      </div>
    `;
    return;
  }

  const errors = violations.filter(v => v.severity === 'error');
  const warnings = violations.filter(v => v.severity === 'warning');

  // Group violations by category
  const byCategory: Record<string, ComplianceViolation[]> = {};
  for (const v of violations) {
    const cat = v.category || 'compliance';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(v);
  }

  container.innerHTML = `
    <div class="compliance-summary">
      <span class="compliance-stat error">${errors.length} errors</span>
      <span class="compliance-stat warning">${warnings.length} warnings</span>
    </div>
    <div class="compliance-categories">
      ${Object.entries(byCategory).map(([category, items]) => `
        <div class="compliance-category">
          <div class="compliance-category-header">
            <span class="category-icon">${CATEGORY_ICONS[category] || '📋'}</span>
            <span class="category-name">${CATEGORY_NAMES[category] || category}</span>
            <span class="category-count">(${items.length})</span>
          </div>
          <div class="compliance-violations">
            ${items.map(v => `
              <div class="violation-item ${v.severity}">
                <span class="violation-icon">${v.severity === 'error' ? '❌' : '⚠️'}</span>
                <div class="violation-info">
                  <div class="violation-element">${formatElementName(v.elementType)}</div>
                  <div class="violation-message">${v.message}</div>
                  <div class="violation-meta">
                    <span class="violation-id">ID: ${v.elementId}</span>
                    <span class="violation-rule">${v.rule}</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function createCompliancePanelHTML(): HTMLDivElement {
  const panel = document.createElement('div');
  panel.id = 'compliance-panel';
  panel.className = 'compliance-panel';

  panel.innerHTML = `
    <div class="compliance-panel-header">
      <span class="compliance-panel-icon">📋</span>
      <span class="compliance-panel-title">BPMN Compliance</span>
      <button class="compliance-panel-close" title="Close">&times;</button>
    </div>
    <div class="compliance-panel-body">
      <div class="compliance-field">
        <label>Compliance Level</label>
        <select id="compliance-level">
          ${Object.entries(LEVEL_NAMES).map(([value, name]) =>
            `<option value="${value}">${name}</option>`
          ).join('')}
        </select>
        <div class="compliance-level-description">
          ${Object.entries(LEVEL_DESCRIPTIONS).map(([level, desc]) =>
            `<p class="level-desc" data-level="${level}">${desc}</p>`
          ).join('')}
        </div>
      </div>

      <div class="compliance-section">
        <div class="compliance-section-title">Allowed Elements</div>
        <div class="allowed-elements-list"></div>
      </div>

      <button id="validate-compliance-btn" class="compliance-validate-btn">
        Validate Compliance
      </button>

      <div class="compliance-info">
        <p>Full validation includes:</p>
        <ul>
          <li>🔍 BPMN lint rules (disconnected elements, missing events, etc.)</li>
          <li>📊 DMN reference validation (model, namespace, decision)</li>
          <li>📄 XML structure checks (data associations)</li>
          <li>⚙️ Task-specific validation (REST, Script, Timer, Message)</li>
        </ul>
      </div>

      <div class="compliance-results"></div>
    </div>
  `;

  return panel;
}
