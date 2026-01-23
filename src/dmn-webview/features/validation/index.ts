/**
 * DMN Validation Panel
 * Provides comprehensive validation for DMN 1.3 models
 */

export interface DmnValidationIssue {
  elementId: string;
  elementType: string;
  elementName?: string;
  rule: string;
  message: string;
  severity: 'error' | 'warning';
  category: 'structure' | 'expression' | 'completeness' | 'reference';
}

// DMN modeler type (simplified)
interface DmnModeler {
  getDefinitions(): DmnDefinitions | null;
  saveXML(options?: { format?: boolean }): Promise<{ xml: string }>;
  getActiveViewer(): DmnViewer | null;
  getViews(): DmnView[];
  open(view: DmnView): void;
}

interface DmnView {
  id: string;
  name: string;
  type: string;
  element?: { id: string };
}

interface DmnViewer {
  get(serviceName: string): unknown;
}

interface OverlayService {
  add(elementId: string, type: string, options: {
    position: { top?: number; right?: number; bottom?: number; left?: number };
    html: string | HTMLElement;
  }): string;
  remove(filter: { type?: string }): void;
}

interface SelectionService {
  select(element: unknown): void;
}

interface CanvasService {
  zoom(level: number | string, center?: { x: number; y: number }): number;
  viewbox(viewbox?: { x: number; y: number; width: number; height: number }): { x: number; y: number; width: number; height: number };
}

interface ElementRegistryService {
  get(id: string): { id: string; x?: number; y?: number; width?: number; height?: number } | undefined;
}

interface DmnDefinitions {
  $type: string;
  id: string;
  name?: string;
  drgElement?: DrgElement[];
  decision?: Decision[];
  inputData?: InputData[];
  businessKnowledgeModel?: BusinessKnowledgeModel[];
  knowledgeSource?: KnowledgeSource[];
}

interface DrgElement {
  $type: string;
  id: string;
  name?: string;
}

interface Decision extends DrgElement {
  decisionLogic?: DecisionLogic;
  informationRequirement?: InformationRequirement[];
  knowledgeRequirement?: KnowledgeRequirement[];
  variable?: Variable;
}

interface InputData extends DrgElement {
  variable?: Variable;
}

interface BusinessKnowledgeModel extends DrgElement {
  encapsulatedLogic?: FunctionDefinition;
  variable?: Variable;
}

interface KnowledgeSource extends DrgElement {
  // Knowledge sources are typically documentation references
}

interface Variable {
  id: string;
  name?: string;
  typeRef?: string;
}

interface DecisionLogic {
  $type: string;
}

interface DecisionTable extends DecisionLogic {
  $type: 'dmn:DecisionTable';
  input?: DecisionTableInput[];
  output?: DecisionTableOutput[];
  rule?: DecisionTableRule[];
  hitPolicy?: string;
}

interface DecisionTableInput {
  id: string;
  label?: string;
  inputExpression?: InputExpression;
  inputValues?: UnaryTests;
}

interface DecisionTableOutput {
  id: string;
  name?: string;
  label?: string;
  typeRef?: string;
  outputValues?: UnaryTests;
}

interface DecisionTableRule {
  id: string;
  inputEntry?: InputEntry[];
  outputEntry?: OutputEntry[];
  description?: string;
}

interface InputExpression {
  text?: string;
  typeRef?: string;
}

interface UnaryTests {
  text?: string;
}

interface InputEntry {
  id: string;
  text?: string;
}

interface OutputEntry {
  id: string;
  text?: string;
}

interface InformationRequirement {
  requiredDecision?: { href: string };
  requiredInput?: { href: string };
}

interface KnowledgeRequirement {
  requiredKnowledge?: { href: string };
}

interface FunctionDefinition extends DecisionLogic {
  $type: 'dmn:FunctionDefinition';
  formalParameter?: FormalParameter[];
  expression?: DecisionLogic;
}

interface FormalParameter {
  id: string;
  name?: string;
  typeRef?: string;
}

interface LiteralExpression extends DecisionLogic {
  $type: 'dmn:LiteralExpression';
  text?: string;
  typeRef?: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  'structure': '🏗️',
  'expression': '📝',
  'completeness': '✅',
  'reference': '🔗'
};

const CATEGORY_NAMES: Record<string, string> = {
  'structure': 'Structure',
  'expression': 'Expressions',
  'completeness': 'Completeness',
  'reference': 'References'
};

/**
 * Validate DMN model and return issues
 */
export function validateDmnModel(modeler: DmnModeler): DmnValidationIssue[] {
  const issues: DmnValidationIssue[] = [];
  const definitions = modeler.getDefinitions();

  if (!definitions) {
    return [{
      elementId: 'unknown',
      elementType: 'Definitions',
      rule: 'no-definitions',
      message: 'Unable to read DMN definitions',
      severity: 'error',
      category: 'structure'
    }];
  }

  // Get all DRG elements
  const decisions = definitions.drgElement?.filter(e => e.$type === 'dmn:Decision') as Decision[] || [];
  const inputData = definitions.drgElement?.filter(e => e.$type === 'dmn:InputData') as InputData[] || [];
  const bkms = definitions.drgElement?.filter(e => e.$type === 'dmn:BusinessKnowledgeModel') as BusinessKnowledgeModel[] || [];
  const knowledgeSources = definitions.drgElement?.filter(e => e.$type === 'dmn:KnowledgeSource') as KnowledgeSource[] || [];

  // Build a map of element IDs for reference validation
  const elementIds = new Set<string>();
  [...decisions, ...inputData, ...bkms, ...knowledgeSources].forEach(el => {
    if (el.id) elementIds.add(el.id);
  });

  // Validate decisions
  for (const decision of decisions) {
    issues.push(...validateDecision(decision, elementIds));
  }

  // Validate input data
  for (const input of inputData) {
    issues.push(...validateInputData(input));
  }

  // Validate BKMs
  for (const bkm of bkms) {
    issues.push(...validateBusinessKnowledgeModel(bkm));
  }

  // Check for orphan elements (no connections)
  issues.push(...validateConnectedness(decisions, inputData, bkms));

  return issues;
}

/**
 * Validate a Decision element
 */
function validateDecision(decision: Decision, elementIds: Set<string>): DmnValidationIssue[] {
  const issues: DmnValidationIssue[] = [];
  const elementName = decision.name || decision.id;

  // Check for missing name
  if (!decision.name || decision.name.trim() === '') {
    issues.push({
      elementId: decision.id,
      elementType: 'Decision',
      elementName,
      rule: 'decision-name-required',
      message: `Decision "${decision.id}" has no name`,
      severity: 'warning',
      category: 'completeness'
    });
  }

  // Check for decision logic
  if (!decision.decisionLogic) {
    issues.push({
      elementId: decision.id,
      elementType: 'Decision',
      elementName,
      rule: 'decision-logic-required',
      message: `Decision "${elementName}" has no decision logic (decision table or literal expression)`,
      severity: 'error',
      category: 'structure'
    });
  } else {
    // Validate the specific type of decision logic
    if (decision.decisionLogic.$type === 'dmn:DecisionTable') {
      issues.push(...validateDecisionTable(decision.id, elementName, decision.decisionLogic as DecisionTable));
    } else if (decision.decisionLogic.$type === 'dmn:LiteralExpression') {
      issues.push(...validateLiteralExpression(decision.id, elementName, decision.decisionLogic as LiteralExpression));
    }
  }

  // Check for information requirements (inputs)
  if (!decision.informationRequirement || decision.informationRequirement.length === 0) {
    // This is a warning - a decision might not need inputs in some cases
    issues.push({
      elementId: decision.id,
      elementType: 'Decision',
      elementName,
      rule: 'decision-no-inputs',
      message: `Decision "${elementName}" has no information requirements (inputs or required decisions)`,
      severity: 'warning',
      category: 'reference'
    });
  } else {
    // Validate that referenced elements exist
    for (const req of decision.informationRequirement) {
      const refId = req.requiredDecision?.href?.replace('#', '') || req.requiredInput?.href?.replace('#', '');
      if (refId && !elementIds.has(refId)) {
        issues.push({
          elementId: decision.id,
          elementType: 'Decision',
          elementName,
          rule: 'invalid-reference',
          message: `Decision "${elementName}" references non-existent element "${refId}"`,
          severity: 'error',
          category: 'reference'
        });
      }
    }
  }

  // Validate knowledge requirements
  if (decision.knowledgeRequirement) {
    for (const req of decision.knowledgeRequirement) {
      const refId = req.requiredKnowledge?.href?.replace('#', '');
      if (refId && !elementIds.has(refId)) {
        issues.push({
          elementId: decision.id,
          elementType: 'Decision',
          elementName,
          rule: 'invalid-knowledge-reference',
          message: `Decision "${elementName}" references non-existent BKM "${refId}"`,
          severity: 'error',
          category: 'reference'
        });
      }
    }
  }

  return issues;
}

/**
 * Validate a Decision Table
 */
function validateDecisionTable(decisionId: string, decisionName: string, table: DecisionTable): DmnValidationIssue[] {
  const issues: DmnValidationIssue[] = [];

  // Check for inputs
  if (!table.input || table.input.length === 0) {
    issues.push({
      elementId: decisionId,
      elementType: 'DecisionTable',
      elementName: decisionName,
      rule: 'decision-table-no-inputs',
      message: `Decision table "${decisionName}" has no input columns`,
      severity: 'warning',
      category: 'completeness'
    });
  } else {
    // Validate each input
    for (let i = 0; i < table.input.length; i++) {
      const input = table.input[i];
      if (!input.inputExpression?.text || input.inputExpression.text.trim() === '') {
        issues.push({
          elementId: decisionId,
          elementType: 'DecisionTable',
          elementName: decisionName,
          rule: 'input-expression-empty',
          message: `Decision table "${decisionName}" input column ${i + 1} has no expression`,
          severity: 'error',
          category: 'expression'
        });
      }
    }
  }

  // Check for outputs
  if (!table.output || table.output.length === 0) {
    issues.push({
      elementId: decisionId,
      elementType: 'DecisionTable',
      elementName: decisionName,
      rule: 'decision-table-no-outputs',
      message: `Decision table "${decisionName}" has no output columns`,
      severity: 'error',
      category: 'structure'
    });
  } else {
    // Validate each output
    for (let i = 0; i < table.output.length; i++) {
      const output = table.output[i];
      if (!output.name || output.name.trim() === '') {
        issues.push({
          elementId: decisionId,
          elementType: 'DecisionTable',
          elementName: decisionName,
          rule: 'output-name-empty',
          message: `Decision table "${decisionName}" output column ${i + 1} has no name`,
          severity: 'warning',
          category: 'completeness'
        });
      }
    }
  }

  // Check for rules
  if (!table.rule || table.rule.length === 0) {
    issues.push({
      elementId: decisionId,
      elementType: 'DecisionTable',
      elementName: decisionName,
      rule: 'decision-table-no-rules',
      message: `Decision table "${decisionName}" has no rules`,
      severity: 'warning',
      category: 'completeness'
    });
  } else {
    // Validate rules have entries
    for (let i = 0; i < table.rule.length; i++) {
      const rule = table.rule[i];

      // Check if all output entries are empty
      const allOutputsEmpty = !rule.outputEntry || rule.outputEntry.every(
        entry => !entry.text || entry.text.trim() === '' || entry.text === '-'
      );

      if (allOutputsEmpty) {
        issues.push({
          elementId: decisionId,
          elementType: 'DecisionTable',
          elementName: decisionName,
          rule: 'rule-empty-outputs',
          message: `Decision table "${decisionName}" rule ${i + 1} has no output values`,
          severity: 'warning',
          category: 'expression'
        });
      }
    }
  }

  // Validate hit policy for multi-output tables
  if (table.output && table.output.length > 1) {
    const hitPolicy = table.hitPolicy || 'UNIQUE';
    if (hitPolicy === 'COLLECT') {
      issues.push({
        elementId: decisionId,
        elementType: 'DecisionTable',
        elementName: decisionName,
        rule: 'collect-multi-output',
        message: `Decision table "${decisionName}" uses COLLECT hit policy with multiple outputs, which may have unexpected behavior`,
        severity: 'warning',
        category: 'structure'
      });
    }
  }

  return issues;
}

/**
 * Validate a Literal Expression
 */
function validateLiteralExpression(decisionId: string, decisionName: string, expr: LiteralExpression): DmnValidationIssue[] {
  const issues: DmnValidationIssue[] = [];

  if (!expr.text || expr.text.trim() === '') {
    issues.push({
      elementId: decisionId,
      elementType: 'LiteralExpression',
      elementName: decisionName,
      rule: 'literal-expression-empty',
      message: `Decision "${decisionName}" has an empty literal expression`,
      severity: 'error',
      category: 'expression'
    });
  }

  return issues;
}

/**
 * Validate Input Data element
 */
function validateInputData(input: InputData): DmnValidationIssue[] {
  const issues: DmnValidationIssue[] = [];
  const elementName = input.name || input.id;

  if (!input.name || input.name.trim() === '') {
    issues.push({
      elementId: input.id,
      elementType: 'InputData',
      elementName,
      rule: 'input-data-name-required',
      message: `Input Data "${input.id}" has no name`,
      severity: 'warning',
      category: 'completeness'
    });
  }

  // Check for variable/type definition
  if (!input.variable?.typeRef) {
    issues.push({
      elementId: input.id,
      elementType: 'InputData',
      elementName,
      rule: 'input-data-type-missing',
      message: `Input Data "${elementName}" has no type reference defined`,
      severity: 'warning',
      category: 'completeness'
    });
  }

  return issues;
}

/**
 * Validate Business Knowledge Model
 */
function validateBusinessKnowledgeModel(bkm: BusinessKnowledgeModel): DmnValidationIssue[] {
  const issues: DmnValidationIssue[] = [];
  const elementName = bkm.name || bkm.id;

  if (!bkm.name || bkm.name.trim() === '') {
    issues.push({
      elementId: bkm.id,
      elementType: 'BusinessKnowledgeModel',
      elementName,
      rule: 'bkm-name-required',
      message: `Business Knowledge Model "${bkm.id}" has no name`,
      severity: 'warning',
      category: 'completeness'
    });
  }

  if (!bkm.encapsulatedLogic) {
    issues.push({
      elementId: bkm.id,
      elementType: 'BusinessKnowledgeModel',
      elementName,
      rule: 'bkm-logic-required',
      message: `Business Knowledge Model "${elementName}" has no encapsulated logic`,
      severity: 'error',
      category: 'structure'
    });
  }

  return issues;
}

/**
 * Check for orphan elements (elements with no connections)
 */
function validateConnectedness(
  decisions: Decision[],
  inputData: InputData[],
  _bkms: BusinessKnowledgeModel[]
): DmnValidationIssue[] {
  const issues: DmnValidationIssue[] = [];

  // Collect all referenced element IDs
  const referencedIds = new Set<string>();
  for (const decision of decisions) {
    if (decision.informationRequirement) {
      for (const req of decision.informationRequirement) {
        const refId = req.requiredDecision?.href?.replace('#', '') || req.requiredInput?.href?.replace('#', '');
        if (refId) referencedIds.add(refId);
      }
    }
    if (decision.knowledgeRequirement) {
      for (const req of decision.knowledgeRequirement) {
        const refId = req.requiredKnowledge?.href?.replace('#', '');
        if (refId) referencedIds.add(refId);
      }
    }
  }

  // Check if input data is used
  for (const input of inputData) {
    if (!referencedIds.has(input.id)) {
      issues.push({
        elementId: input.id,
        elementType: 'InputData',
        elementName: input.name || input.id,
        rule: 'orphan-input-data',
        message: `Input Data "${input.name || input.id}" is not used by any decision`,
        severity: 'warning',
        category: 'reference'
      });
    }
  }

  return issues;
}

// Overlay type constant
const VALIDATION_OVERLAY_TYPE = 'dmn-validation';

/**
 * Add validation overlays to DRD elements
 */
function addValidationOverlays(modeler: DmnModeler, issues: DmnValidationIssue[]): void {
  const activeViewer = modeler.getActiveViewer();
  if (!activeViewer) return;

  // Only add overlays in DRD view
  const views = modeler.getViews();
  const drdView = views.find(v => v.type === 'drd');
  if (!drdView) return;

  try {
    const overlays = activeViewer.get('overlays') as OverlayService | undefined;
    if (!overlays) return;

    // Remove existing validation overlays
    try {
      overlays.remove({ type: VALIDATION_OVERLAY_TYPE });
    } catch (_e) {
      // Ignore errors when no overlays exist
    }

    // Group issues by element
    const issuesByElement = new Map<string, DmnValidationIssue[]>();
    for (const issue of issues) {
      const existing = issuesByElement.get(issue.elementId) || [];
      existing.push(issue);
      issuesByElement.set(issue.elementId, existing);
    }

    // Add overlay for each element with issues
    for (const [elementId, elementIssues] of issuesByElement) {
      const hasError = elementIssues.some(i => i.severity === 'error');
      const overlayHtml = createOverlayElement(elementIssues, hasError);

      try {
        overlays.add(elementId, VALIDATION_OVERLAY_TYPE, {
          position: { top: -10, right: -10 },
          html: overlayHtml
        });
      } catch (_e) {
        // Element might not exist in current view
      }
    }
  } catch (_e) {
    // Overlays service might not be available
  }
}

/**
 * Create overlay HTML element
 */
function createOverlayElement(issues: DmnValidationIssue[], hasError: boolean): HTMLElement {
  const container = document.createElement('div');
  container.className = `dmn-validation-overlay ${hasError ? 'error' : 'warning'}`;

  // Icon badge
  const icon = document.createElement('div');
  icon.className = `dmn-validation-overlay-icon ${hasError ? 'error' : 'warning'}`;
  icon.innerHTML = hasError
    ? '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 100 16A8 8 0 008 0zm0 12a1 1 0 110-2 1 1 0 010 2zm1-3H7V4h2v5z"/></svg>'
    : '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 100 16A8 8 0 008 0zm0 12a1 1 0 110-2 1 1 0 010 2zm1-3H7V4h2v5z"/></svg>';
  container.appendChild(icon);

  // Dropdown with issues list
  const dropdown = document.createElement('div');
  dropdown.className = 'dmn-validation-overlay-dropdown';

  const issuesList = document.createElement('ul');
  issuesList.className = 'dmn-validation-overlay-issues';

  for (const issue of issues) {
    const li = document.createElement('li');
    li.className = issue.severity;
    li.innerHTML = `
      <span class="issue-icon">${issue.severity === 'error' ? '❌' : '⚠️'}</span>
      <span class="issue-message">${issue.message}</span>
    `;
    issuesList.appendChild(li);
  }

  dropdown.appendChild(issuesList);
  container.appendChild(dropdown);

  return container;
}

/**
 * Navigate to element in DRD view and select it
 */
function navigateToElement(modeler: DmnModeler, elementId: string): void {
  // Switch to DRD view first
  const views = modeler.getViews();
  const drdView = views.find(v => v.type === 'drd');
  if (drdView) {
    modeler.open(drdView);

    // Give time for view to load, then select and zoom to element
    setTimeout(() => {
      const activeViewer = modeler.getActiveViewer();
      if (!activeViewer) return;

      try {
        const elementRegistry = activeViewer.get('elementRegistry') as ElementRegistryService;
        const selection = activeViewer.get('selection') as SelectionService;
        const canvas = activeViewer.get('canvas') as CanvasService;

        const element = elementRegistry?.get(elementId);
        if (element) {
          // Select the element
          selection?.select(element);

          // Center viewport on element
          if (element.x !== undefined && element.y !== undefined) {
            const viewbox = canvas?.viewbox();
            if (viewbox) {
              const centerX = element.x + (element.width || 0) / 2;
              const centerY = element.y + (element.height || 0) / 2;
              canvas?.viewbox({
                x: centerX - viewbox.width / 2,
                y: centerY - viewbox.height / 2,
                width: viewbox.width,
                height: viewbox.height
              });
            }
          }
        }
      } catch (_e) {
        // Services might not be available
      }
    }, 100);
  }
}

/**
 * Initialize the DMN validation panel
 */
export function initDmnValidationPanel(
  modeler: DmnModeler,
  onValidationComplete?: (issues: DmnValidationIssue[]) => void
): {
  show: () => void;
  hide: () => void;
  validate: () => DmnValidationIssue[];
  clearOverlays: () => void;
} {
  const panel = createValidationPanelHTML();
  document.body.appendChild(panel);

  const closeButton = panel.querySelector('.dmn-validation-panel-close') as HTMLButtonElement;
  const validateBtn = panel.querySelector('#dmn-validate-btn') as HTMLButtonElement;
  const resultsDiv = panel.querySelector('.dmn-validation-results') as HTMLDivElement;

  closeButton.addEventListener('click', () => {
    panel.classList.remove('visible');
  });

  validateBtn.addEventListener('click', () => {
    const issues = validateDmnModel(modeler);
    renderIssues(issues, resultsDiv, modeler);
    addValidationOverlays(modeler, issues);
    onValidationComplete?.(issues);
  });

  function show() {
    panel.classList.add('visible');
    // Auto-validate when panel opens
    const issues = validateDmnModel(modeler);
    renderIssues(issues, resultsDiv, modeler);
    addValidationOverlays(modeler, issues);
    onValidationComplete?.(issues);
  }

  function hide() {
    panel.classList.remove('visible');
  }

  function validate(): DmnValidationIssue[] {
    const issues = validateDmnModel(modeler);
    addValidationOverlays(modeler, issues);
    return issues;
  }

  function clearOverlays(): void {
    const activeViewer = modeler.getActiveViewer();
    if (activeViewer) {
      try {
        const overlays = activeViewer.get('overlays') as OverlayService | undefined;
        overlays?.remove({ type: VALIDATION_OVERLAY_TYPE });
      } catch (_e) {
        // Ignore
      }
    }
  }

  return { show, hide, validate, clearOverlays };
}

function renderIssues(issues: DmnValidationIssue[], container: HTMLDivElement, modeler?: DmnModeler): void {
  if (issues.length === 0) {
    container.innerHTML = `
      <div class="dmn-validation-success">
        <span class="dmn-validation-icon">✅</span>
        <span>DMN model is valid - no issues found</span>
      </div>
    `;
    return;
  }

  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');

  // Group by category
  const byCategory: Record<string, DmnValidationIssue[]> = {};
  for (const issue of issues) {
    if (!byCategory[issue.category]) byCategory[issue.category] = [];
    byCategory[issue.category].push(issue);
  }

  container.innerHTML = `
    <div class="dmn-validation-summary">
      <span class="dmn-validation-stat error">${errors.length} errors</span>
      <span class="dmn-validation-stat warning">${warnings.length} warnings</span>
    </div>
    <div class="dmn-validation-categories">
      ${Object.entries(byCategory).map(([category, categoryIssues]) => `
        <div class="dmn-validation-category">
          <div class="dmn-validation-category-header">
            <span class="category-icon">${CATEGORY_ICONS[category] || '📋'}</span>
            <span class="category-name">${CATEGORY_NAMES[category] || category}</span>
            <span class="category-count">(${categoryIssues.length})</span>
          </div>
          <div class="dmn-validation-issues">
            ${categoryIssues.map(issue => `
              <div class="dmn-issue-item ${issue.severity} clickable" data-element-id="${issue.elementId}">
                <span class="dmn-issue-icon">${issue.severity === 'error' ? '❌' : '⚠️'}</span>
                <div class="dmn-issue-info">
                  <div class="dmn-issue-element">${issue.elementType}: ${issue.elementName || issue.elementId}</div>
                  <div class="dmn-issue-message">${issue.message}</div>
                  <div class="dmn-issue-meta">
                    <span class="dmn-issue-rule">${issue.rule}</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // Add click handlers to navigate to elements
  if (modeler) {
    const issueItems = container.querySelectorAll('.dmn-issue-item.clickable');
    issueItems.forEach(item => {
      item.addEventListener('click', () => {
        const elementId = (item as HTMLElement).dataset.elementId;
        if (elementId) {
          navigateToElement(modeler, elementId);
        }
      });
    });
  }
}

function createValidationPanelHTML(): HTMLDivElement {
  const panel = document.createElement('div');
  panel.id = 'dmn-validation-panel';
  panel.className = 'dmn-validation-panel';

  panel.innerHTML = `
    <div class="dmn-validation-panel-header">
      <span class="dmn-validation-panel-icon">✓</span>
      <span class="dmn-validation-panel-title">DMN Validation</span>
      <button class="dmn-validation-panel-close" title="Close">&times;</button>
    </div>
    <div class="dmn-validation-panel-body">
      <div class="dmn-validation-info">
        <p>Validates your DMN model for:</p>
        <ul>
          <li>🏗️ Structure - Decision logic, inputs, outputs</li>
          <li>📝 Expressions - Empty or invalid FEEL expressions</li>
          <li>✅ Completeness - Names, types, rules</li>
          <li>🔗 References - Valid connections between elements</li>
        </ul>
      </div>

      <button id="dmn-validate-btn" class="dmn-validate-btn">
        Validate DMN Model
      </button>

      <div class="dmn-validation-results"></div>
    </div>
  `;

  return panel;
}
