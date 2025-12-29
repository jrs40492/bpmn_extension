/**
 * BPMN Compliance Levels
 * Support different BPMN 2.0 compliance levels with validation
 */

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

export function initCompliancePanel(
  getElements: () => unknown[],
  onLevelChange?: (level: ComplianceLevel) => void
): {
  show: () => void;
  hide: () => void;
  setLevel: (level: ComplianceLevel) => void;
  getLevel: () => ComplianceLevel;
  validate: () => ComplianceViolation[];
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

  validateBtn.addEventListener('click', () => {
    const violations = validateCompliance(getElements(), currentLevel);
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
    return validateCompliance(getElements(), currentLevel);
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
    validate
  };
}

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
        severity: 'error'
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
          severity: 'warning'
        });
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

  container.innerHTML = `
    <div class="compliance-summary">
      <span class="compliance-stat error">${errors.length} errors</span>
      <span class="compliance-stat warning">${warnings.length} warnings</span>
    </div>
    <div class="compliance-violations">
      ${violations.map(v => `
        <div class="violation-item ${v.severity}">
          <span class="violation-icon">${v.severity === 'error' ? '❌' : '⚠️'}</span>
          <div class="violation-info">
            <div class="violation-element">${formatElementName(v.elementType)}</div>
            <div class="violation-message">${v.message}</div>
            <div class="violation-id">ID: ${v.elementId}</div>
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

      <div class="compliance-results"></div>
    </div>
  `;

  return panel;
}
