import BpmnModeler from 'bpmn-js/lib/Modeler';

// @ts-expect-error - no type definitions available
import { BpmnPropertiesPanelModule, BpmnPropertiesProviderModule } from 'bpmn-js-properties-panel';
// @ts-expect-error - no type definitions available
import minimapModule from 'diagram-js-minimap';
// @ts-expect-error - no type definitions available
import gridModule from 'diagram-js-grid';
// @ts-expect-error - no type definitions available
import tokenSimulationModule from 'bpmn-js-token-simulation';
// @ts-expect-error - no type definitions available
import lintModule from 'bpmn-js-bpmnlint';

// Import individual bpmnlint rules for bundling
// @ts-expect-error - no type definitions available
import noDisconnected from 'bpmnlint/rules/no-disconnected';
// @ts-expect-error - no type definitions available
import noImplicitSplit from 'bpmnlint/rules/no-implicit-split';
// @ts-expect-error - no type definitions available
import startEventRequired from 'bpmnlint/rules/start-event-required';
// @ts-expect-error - no type definitions available
import endEventRequired from 'bpmnlint/rules/end-event-required';
// @ts-expect-error - no type definitions available
import fakeJoin from 'bpmnlint/rules/fake-join';
// @ts-expect-error - no type definitions available
import noComplexGateway from 'bpmnlint/rules/no-complex-gateway';
// @ts-expect-error - no type definitions available
import noDuplicateSequenceFlows from 'bpmnlint/rules/no-duplicate-sequence-flows';
// @ts-expect-error - no type definitions available
import noGatewayJoinFork from 'bpmnlint/rules/no-gateway-join-fork';
// @ts-expect-error - no type definitions available
import singleBlankStartEvent from 'bpmnlint/rules/single-blank-start-event';
// @ts-expect-error - no type definitions available
import singleEventDefinition from 'bpmnlint/rules/single-event-definition';
// @ts-expect-error - no type definitions available
import subProcessBlankStartEvent from 'bpmnlint/rules/sub-process-blank-start-event';

// Custom REST task extension (uses standard BPMN, only drools descriptor needed)
import restTaskModule, { droolsDescriptor } from './extensions/rest-task';

// Custom Kafka task extension
import kafkaTaskModule, { kafkaTaskDescriptor } from './extensions/kafka-task';

// Custom Script task extension
import scriptTaskModule from './extensions/script-task';

// Custom User Task extension
import userTaskModule from './extensions/user-task';

// Custom Java Service Task extension
import javaServiceTaskModule from './extensions/service-task';

// Custom Business Rule Task extension (DMN linking)
import businessRuleTaskModule, { businessRuleTaskDescriptor } from './extensions/business-rule-task';

// Custom Process Variables extension
import processVariablesModule, { processVariablesDescriptor } from './extensions/process-variables';

// Custom Message Event extension
import messageEventModule, { messageEventDescriptor } from './extensions/message-event';

// Custom error boundary multi-error extension
import errorBoundaryModule, { errorBoundaryDescriptor } from './extensions/error-boundary';

// Custom event colors extension
import eventColorsModule from './extensions/event-colors';

// Custom label colors extension (dark mode text visibility)
import labelColorsModule from './extensions/label-colors';

// Custom properties panel colors extension
import propertiesPanelColorsModule from './extensions/properties-panel-colors';

// Custom compensation task context pad extension
import compensationTaskModule from './extensions/compensation-task';

// Custom sequence flow condition extension
import sequenceFlowConditionModule from './extensions/sequence-flow-condition';

// Custom gateway direction extension
import gatewayDirectionModule from './extensions/gateway-direction';

// Custom task resize extension
import taskResizeModule from './extensions/task-resize';

// Helper to unwrap default exports from bundled modules
function unwrapRule(rule: unknown): unknown {
  if (rule && typeof rule === 'object' && 'default' in rule) {
    return (rule as { default: unknown }).default;
  }
  return rule;
}

// Bundled bpmnlint rules map
const bundledRules: Record<string, unknown> = {
  'no-disconnected': unwrapRule(noDisconnected),
  'no-implicit-split': unwrapRule(noImplicitSplit),
  'start-event-required': unwrapRule(startEventRequired),
  'end-event-required': unwrapRule(endEventRequired),
  'fake-join': unwrapRule(fakeJoin),
  'no-complex-gateway': unwrapRule(noComplexGateway),
  'no-duplicate-sequence-flows': unwrapRule(noDuplicateSequenceFlows),
  'no-gateway-join-fork': unwrapRule(noGatewayJoinFork),
  'single-blank-start-event': unwrapRule(singleBlankStartEvent),
  'single-event-definition': unwrapRule(singleEventDefinition),
  'sub-process-blank-start-event': unwrapRule(subProcessBlankStartEvent)
};

// bpmnlint rules configuration (matching .bpmnlintrc)
const linterConfig = {
  resolver: {
    resolveRule: (_pkg: string, ruleName: string) => {
      return bundledRules[ruleName] || null;
    }
  },
  config: {
    rules: {
      'no-disconnected': 'error',
      'no-implicit-split': 'warn',
      'start-event-required': 'error',
      'end-event-required': 'error',
      'fake-join': 'warn',
      'no-complex-gateway': 'warn',
      'no-duplicate-sequence-flows': 'error',
      'no-gateway-join-fork': 'warn',
      'single-blank-start-event': 'warn',
      'single-event-definition': 'error',
      'sub-process-blank-start-event': 'warn'
    }
  }
};

// Type definitions for bpmn-js
interface BpmnModelerInstance {
  importXML(xml: string): Promise<{ warnings: string[] }>;
  saveXML(options?: { format?: boolean }): Promise<{ xml: string }>;
  get<T>(name: string): T;
  destroy(): void;
}

interface Viewbox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Canvas {
  zoom(): number;
  zoom(level: number | 'fit-viewport'): number;
  viewbox(): Viewbox;
  viewbox(box: Viewbox): Viewbox;
  scrollToElement(element: unknown): void;
}

interface EventBus {
  on(event: string, callback: (event: unknown) => void): void;
  off(event: string, callback: (event: unknown) => void): void;
}

interface Point {
  x: number;
  y: number;
}

interface Connection {
  waypoints: Point[];
  source: unknown;
  target: unknown;
}

interface ConnectionDocking {
  getCroppedWaypoints(connection: Connection): Point[];
}

interface GraphicsFactory {
  update(type: string, element: unknown, gfx: SVGElement): void;
}

interface ElementRegistry {
  getAll(): unknown[];
  get(id: string): unknown;
  getGraphics(element: unknown): SVGElement;
}

interface Selection {
  select(element: unknown): void;
  deselect(element: unknown): void;
}

interface ToggleMode {
  toggleMode(): void;
  isActive(): boolean;
}

export interface Modeling {
  updateProperties: (element: unknown, props: Record<string, unknown>) => void;
}

export interface Modeler extends BpmnModelerInstance {
  get(name: 'canvas'): Canvas;
  get(name: 'eventBus'): EventBus;
  get(name: 'elementRegistry'): ElementRegistry;
  get(name: 'selection'): Selection;
  get(name: 'toggleMode'): ToggleMode;
  get(name: 'modeling'): Modeling;
  get(name: 'connectionDocking'): ConnectionDocking;
  get(name: 'graphicsFactory'): GraphicsFactory;
  get<T>(name: string): T;
}

/**
 * Create a new bpmn-js modeler instance with properties panel and minimap
 */
export function createModeler(
  container: HTMLElement,
  propertiesContainer: HTMLElement | null
): Modeler {
  const additionalModules = [
    minimapModule,
    gridModule,
    lintModule,
    restTaskModule,
    kafkaTaskModule,
    scriptTaskModule,
    userTaskModule,
    javaServiceTaskModule,
    businessRuleTaskModule,
    processVariablesModule,
    messageEventModule,
    eventColorsModule,
    labelColorsModule,
    errorBoundaryModule,
    compensationTaskModule,
    tokenSimulationModule,
    taskResizeModule
  ];

  // Add properties panel if container is provided
  if (propertiesContainer) {
    additionalModules.push(
      BpmnPropertiesPanelModule,
      BpmnPropertiesProviderModule,
      sequenceFlowConditionModule,
      gatewayDirectionModule,
      propertiesPanelColorsModule
    );
  }

  const modeler = new BpmnModeler({
    container,
    keyboard: {
      bindTo: document
    },
    additionalModules,
    moddleExtensions: {
      // Note: REST tasks now use standard BPMN elements, no custom extension needed
      kafka: kafkaTaskDescriptor,
      dmn: businessRuleTaskDescriptor,
      bamoe: processVariablesDescriptor,
      drools: droolsDescriptor,
      msgevt: messageEventDescriptor,
      errbnd: errorBoundaryDescriptor
    },
    propertiesPanel: propertiesContainer ? {
      parent: propertiesContainer,
      layout: {
        groups: {
          'rest-configuration': { open: true }
        }
      }
    } : undefined,
    minimap: {
      open: false
    },
    linting: {
      bpmnlint: linterConfig
    }
  }) as unknown as Modeler;

  return modeler;
}

/**
 * Import a BPMN diagram from XML
 */
export async function importDiagram(modeler: Modeler, xml: string): Promise<void> {
  if (!xml || xml.trim() === '') {
    // Use a minimal default diagram for empty files
    xml = getEmptyDiagram();
  }

  // Collapse expanded multi-error boundary events back into single visual events
  xml = collapseMultiErrorBoundaryEvents(xml);

  const result = await modeler.importXML(xml);

  if (result.warnings && result.warnings.length > 0) {
    console.warn('BPMN import warnings:', result.warnings);
  }

  cropImportedConnections(modeler);
}

/**
 * Crop imported connection waypoints to shape boundaries.
 *
 * External editors (e.g., KIE/jBPM) store center-to-center waypoints in the
 * BPMN DI, which is valid per the spec. bpmn-js's CroppingConnectionDocking
 * only crops during modeling operations, not during importXML. This function
 * applies the same cropping after import so arrows connect at shape edges
 * instead of passing through node centers.
 */
function cropImportedConnections(modeler: Modeler): void {
  const elementRegistry = modeler.get('elementRegistry');
  const connectionDocking = modeler.get('connectionDocking');
  const graphicsFactory = modeler.get('graphicsFactory');

  const elements = elementRegistry.getAll();

  for (const element of elements) {
    const connection = element as unknown as Connection;
    if (!connection.waypoints) {
      continue;
    }

    try {
      const croppedWaypoints = connectionDocking.getCroppedWaypoints(connection);
      connection.waypoints = croppedWaypoints;
      const gfx = elementRegistry.getGraphics(element);
      if (gfx) {
        graphicsFactory.update('connection', element, gfx);
      }
    } catch (e) {
      // Some connections (e.g., cross-pool data associations) may fail to crop
      console.warn('Failed to crop connection waypoints:', e);
    }
  }
}

/**
 * Export the current diagram as XML
 */
export async function exportDiagram(modeler: Modeler): Promise<string> {
  const result = await modeler.saveXML({ format: true });
  let xml = result.xml;

  // Fix element name casing for BPMN 2.0 compliance
  // bpmn-js sometimes outputs uppercase element names like <bpmn:Task>
  // but BPMN 2.0 XSD requires lowercase like <bpmn:task>
  xml = fixBpmnElementCasing(xml);

  // Fix incomplete DataAssociations (missing sourceRef/targetRef)
  // This prevents NullPointerException in jBPM when getTarget() or getLabel() is called
  xml = fixIncompleteDataAssociations(xml);

  // Reorder root elements so definitions (error, signal, etc.) appear before <process>
  // jBPM parses in document order and fails if errorRef references appear before the error definition
  xml = reorderRootElements(xml);

  // Expand multi-error boundary events into multiple BPMN-compliant boundary events
  xml = expandMultiErrorBoundaryEvents(xml);

  // Add process variable mappings for REST tasks that use {variableName} placeholders
  xml = addRestTaskVariableMappings(xml);

  // Remove orphaned bpmn:error elements not referenced by any errorEventDefinition
  xml = removeOrphanedErrorElements(xml);

  return xml;
}

/**
 * Fix incomplete DataAssociations that are missing required sourceRef or targetRef elements.
 *
 * jBPM requires:
 * - DataInputAssociation: must have sourceRef (process variable) and targetRef (task input)
 * - DataOutputAssociation: must have sourceRef (task output) and targetRef (process variable)
 *
 * This function adds missing elements to prevent NullPointerException in jBPM.
 */
function fixIncompleteDataAssociations(xml: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    console.warn('Failed to parse XML for data association fix:', parseError.textContent);
    return xml;
  }

  let modified = false;

  // Fix DataOutputAssociations missing targetRef or with invalid targetRef value
  const outputAssocs = doc.querySelectorAll('dataOutputAssociation, DataOutputAssociation');
  for (const assoc of outputAssocs) {
    const sourceRef = assoc.querySelector('sourceRef');
    const targetRef = assoc.querySelector('targetRef');
    const targetRefValue = targetRef?.textContent?.trim() || '';

    // Fix if targetRef is missing OR has invalid value like "undefined", "null", or empty
    const needsFix = !targetRef || !targetRefValue || targetRefValue === 'undefined' || targetRefValue === 'null';

    if (sourceRef && needsFix) {
      // Missing or invalid targetRef - add/fix with a default one based on the output name
      const sourceId = sourceRef.textContent || '';
      // Extract variable name from sourceId (e.g., "Activity_05jwo4m_ResultOutput" -> "result")
      let varName = 'result';
      if (sourceId.includes('_')) {
        const parts = sourceId.split('_');
        const outputName = parts[parts.length - 1].replace('Output', '');
        varName = outputName.toLowerCase() || 'result';
      }

      if (targetRef) {
        // Update existing targetRef with proper value
        targetRef.textContent = varName;
      } else {
        // Create new targetRef element
        const targetRefElem = doc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:targetRef');
        targetRefElem.textContent = varName;
        assoc.appendChild(targetRefElem);
      }
      modified = true;
      console.log(`Fixed DataOutputAssociation: set targetRef="${varName}"`);
    }
  }

  // Fix DataInputAssociations that map process variables to task inputs
  // Convert sourceRef/targetRef format to assignment format for jBPM compatibility
  // jBPM handles assignment-based mappings more reliably
  const inputAssocs = doc.querySelectorAll('dataInputAssociation, DataInputAssociation');
  for (const assoc of inputAssocs) {
    const sourceRef = assoc.querySelector('sourceRef');
    const targetRef = assoc.querySelector('targetRef');
    const assignment = assoc.querySelector('assignment, Assignment');

    // Case 1: Has sourceRef/targetRef but no assignment - this is the correct format, leave it alone
    // The sourceRef should point to a process-level property element
    if (sourceRef && targetRef && !assignment) {
      // This format is correct for jBPM/Kogito - no changes needed
      // Just ensure it stays as sourceRef/targetRef pattern
    }
    // Case 2: Has targetRef but no sourceRef and no assignment - add sourceRef
    else if (targetRef && !sourceRef && !assignment) {
      const targetId = targetRef.textContent || '';
      // Extract variable name from targetId (e.g., "Activity_05jwo4m_ddidInput" -> "ddid")
      let varName = 'input';
      if (targetId.includes('_')) {
        const parts = targetId.split('_');
        const inputName = parts[parts.length - 1].replace('Input', '');
        varName = inputName.toLowerCase() || 'input';
      }

      // Add sourceRef pointing to the process-level property
      const sourceRefElem = doc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:sourceRef');
      sourceRefElem.textContent = varName;
      assoc.insertBefore(sourceRefElem, targetRef);

      modified = true;
      console.log(`Fixed DataInputAssociation: added sourceRef="${varName}" -> "${targetId}"`);
    }
  }

  if (modified) {
    const serializer = new XMLSerializer();
    return serializer.serializeToString(doc);
  }

  return xml;
}

/**
 * Reorder root elements in bpmn:definitions so that definition-level elements
 * (error, itemDefinition, message, signal, escalation) appear before the first
 * bpmn:process element.
 *
 * bpmn-js places newly created root elements after the process, but jBPM parses
 * elements in document order. If a process references an error (errorRef) that
 * is defined after the process closing tag, jBPM throws
 * ProcessParsingValidationException because the reference can't be resolved.
 */
function reorderRootElements(xml: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    console.warn('Failed to parse XML for root element reordering:', parseError.textContent);
    return xml;
  }

  const definitions = doc.documentElement;
  const elementsToMove = new Set([
    'error', 'itemDefinition', 'message', 'signal', 'escalation'
  ]);

  // Find the first process element
  let processEl: Element | null = null;
  for (const child of definitions.children) {
    if (child.localName === 'process') {
      processEl = child;
      break;
    }
  }

  if (!processEl) return xml;

  // Collect elements that appear after the process and need to move
  let modified = false;
  const toMove: Element[] = [];
  let afterProcess = false;

  for (const child of definitions.children) {
    if (child === processEl) {
      afterProcess = true;
      continue;
    }
    if (afterProcess && elementsToMove.has(child.localName)) {
      toMove.push(child);
    }
  }

  if (toMove.length === 0) return xml;

  // Move each element to just before the process
  for (const el of toMove) {
    definitions.insertBefore(el, processEl);
    modified = true;
  }

  if (modified) {
    const serializer = new XMLSerializer();
    return serializer.serializeToString(doc);
  }

  return xml;
}

/**
 * Add process variable mappings for REST tasks that use {variableName} placeholders.
 *
 * jBPM/Kogito RESTWorkItemHandler expects variables to be passed as input parameters.
 * When a URL or Content contains {variableName}, we need to:
 * 1. Add an itemDefinition at definitions level
 * 2. Add a property element at process level
 * 3. Add a dataInput for that variable in the task
 * 4. Add a dataInputAssociation with sourceRef pointing to the process property
 *
 * This allows the runtime to substitute {variableName} with the actual process variable value.
 */
function addRestTaskVariableMappings(xml: string): string {
  // Parse the XML using DOMParser
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');

  // Check for parse errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    console.warn('Failed to parse XML for REST task variable mapping:', parseError.textContent);
    return xml;
  }

  // Get the definitions element and process element
  const definitions = doc.querySelector('definitions');
  const process = doc.querySelector('process');
  if (!definitions || !process) return xml;

  // Track existing itemDefinitions and properties
  const existingItemDefs = new Set<string>();
  const existingProperties = new Set<string>();

  doc.querySelectorAll('itemDefinition').forEach(item => {
    const id = item.getAttribute('id');
    if (id) existingItemDefs.add(id);
  });

  process.querySelectorAll(':scope > property').forEach(prop => {
    const id = prop.getAttribute('id');
    if (id) existingProperties.add(id);
  });

  // Find all tasks with drools:taskName="Rest"
  const tasks = doc.querySelectorAll('task, Task');
  let modified = false;

  // Collect all variables needed across all REST tasks
  const allVariablesNeeded = new Set<string>();

  for (const task of tasks) {
    const taskName = task.getAttribute('drools:taskName');
    if (taskName !== 'Rest') continue;

    const taskId = task.getAttribute('id') || '';

    // Find the ioSpecification
    const ioSpec = task.querySelector('ioSpecification, inputOutputSpecification');
    if (!ioSpec) continue;

    // Get existing dataInputs
    const existingInputs = new Set<string>();
    const dataInputs = ioSpec.querySelectorAll('dataInput, DataInput');
    for (const input of dataInputs) {
      const name = input.getAttribute('name');
      if (name) existingInputs.add(name);
    }

    // Find all {variableName} placeholders in URL and Content
    const variablesNeeded = new Set<string>();
    const associations = task.querySelectorAll('dataInputAssociation, DataInputAssociation');

    for (const assoc of associations) {
      const targetRef = assoc.querySelector('targetRef');
      if (!targetRef) continue;

      const targetId = targetRef.textContent || '';
      // Check if this is URL or Content
      if (!targetId.includes('UrlInput') && !targetId.includes('ContentInput')) continue;

      // Find the assignment value
      const assignment = assoc.querySelector('assignment, Assignment');
      if (!assignment) continue;

      const fromExpr = assignment.querySelector('from');
      if (!fromExpr) continue;

      const value = fromExpr.textContent || '';

      // Extract all {variableName} and ${variableName} patterns
      // Supports both {var} (BPMN style) and ${var} (jBPM/Kogito expression style)
      const regex = /\$?\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
      let match;
      while ((match = regex.exec(value)) !== null) {
        const varName = match[1];
        // Skip standard REST params
        if (!['Url', 'Method', 'ContentType', 'Content', 'ConnectTimeout', 'ReadTimeout', 'Result'].includes(varName)) {
          variablesNeeded.add(varName);
          allVariablesNeeded.add(varName);
        }
      }
    }

    // Add dataInput and dataInputAssociation for each variable not already mapped
    for (const varName of variablesNeeded) {
      if (existingInputs.has(varName)) continue;

      modified = true;
      const inputId = `${taskId}_${varName}Input`;

      // Create dataInput element
      const dataInput = doc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:dataInput');
      dataInput.setAttribute('id', inputId);
      dataInput.setAttribute('name', varName);
      dataInput.setAttribute('drools:dtype', 'java.lang.String');

      // Add to ioSpecification (before inputSet)
      const inputSet = ioSpec.querySelector('inputSet, InputSet');
      if (inputSet) {
        ioSpec.insertBefore(dataInput, inputSet);

        // Add dataInputRefs to inputSet
        const dataInputRefs = doc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:dataInputRefs');
        dataInputRefs.textContent = inputId;
        inputSet.appendChild(dataInputRefs);
      } else {
        ioSpec.appendChild(dataInput);
      }

      // Create dataInputAssociation with sourceRef/targetRef pattern
      // This references the process-level property element
      const dataInputAssoc = doc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:dataInputAssociation');

      const sourceRef = doc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:sourceRef');
      sourceRef.textContent = varName;
      dataInputAssoc.appendChild(sourceRef);

      const targetRefElem = doc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:targetRef');
      targetRefElem.textContent = inputId;
      dataInputAssoc.appendChild(targetRefElem);

      // Find the last dataInputAssociation to insert after
      const existingAssocs = task.querySelectorAll('dataInputAssociation, DataInputAssociation');
      if (existingAssocs.length > 0) {
        const lastAssoc = existingAssocs[existingAssocs.length - 1];
        lastAssoc.parentNode?.insertBefore(dataInputAssoc, lastAssoc.nextSibling);
      } else {
        // Insert after ioSpecification
        ioSpec.parentNode?.insertBefore(dataInputAssoc, ioSpec.nextSibling);
      }

      existingInputs.add(varName);
    }
  }

  // Add itemDefinitions and properties for all variables needed
  for (const varName of allVariablesNeeded) {
    const itemDefId = `_${varName}Item`;

    // Add itemDefinition at definitions level if not exists
    if (!existingItemDefs.has(itemDefId)) {
      const itemDef = doc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:itemDefinition');
      itemDef.setAttribute('id', itemDefId);
      itemDef.setAttribute('structureRef', 'java.lang.String');

      // Insert before the first process element
      definitions.insertBefore(itemDef, process);
      existingItemDefs.add(itemDefId);
      modified = true;
    }

    // Add property at process level if not exists
    if (!existingProperties.has(varName)) {
      const property = doc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:property');
      property.setAttribute('id', varName);
      property.setAttribute('name', varName);
      property.setAttribute('itemSubjectRef', itemDefId);

      // Insert after extensionElements or as first child of process
      const extElements = process.querySelector('extensionElements');
      if (extElements) {
        extElements.parentNode?.insertBefore(property, extElements.nextSibling);
      } else {
        process.insertBefore(property, process.firstChild);
      }
      existingProperties.add(varName);
      modified = true;
    }
  }

  if (modified) {
    // Serialize back to XML
    const serializer = new XMLSerializer();
    return serializer.serializeToString(doc);
  }

  return xml;
}

/**
 * Remove orphaned bpmn:error elements from definitions that are not referenced
 * by any errorEventDefinition in the document.
 *
 * When multi-error boundary events are expanded on export, ensureErrorElement()
 * creates bpmn:error elements. On reimport, collapse removes cloned events but
 * leaves the error definitions. If the boundary event is later deleted, those
 * error elements remain as orphans.
 */
function removeOrphanedErrorElements(xml: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    console.warn('Failed to parse XML for orphaned error cleanup:', parseError.textContent);
    return xml;
  }

  const definitions = doc.documentElement;

  // Collect all errorRef values from every errorEventDefinition in the document
  const referencedErrorIds = new Set<string>();
  const errorEventDefs = doc.querySelectorAll('errorEventDefinition');
  for (const eed of errorEventDefs) {
    const errorRef = eed.getAttribute('errorRef');
    if (errorRef) {
      referencedErrorIds.add(errorRef);
    }
  }

  // Find and remove bpmn:error elements whose id is not in the referenced set
  let modified = false;
  const toRemove: Element[] = [];

  for (const child of definitions.children) {
    if (child.localName === 'error') {
      const id = child.getAttribute('id');
      if (id && !referencedErrorIds.has(id)) {
        toRemove.push(child);
      }
    }
  }

  for (const el of toRemove) {
    definitions.removeChild(el);
    modified = true;
  }

  if (modified) {
    const serializer = new XMLSerializer();
    return serializer.serializeToString(doc);
  }

  return xml;
}

/**
 * Fix BPMN element casing to match BPMN 2.0 XSD requirements
 * Converts uppercase element names to lowercase (e.g., Task -> task)
 */
function fixBpmnElementCasing(xml: string): string {
  // List of BPMN elements that need lowercase first letter
  const elementsToFix = [
    'Task',
    'BusinessRuleTask',
    'DataInput',
    'DataOutput',
    'InputSet',
    'OutputSet',
    'InputOutputSpecification',
    'DataInputAssociation',
    'DataOutputAssociation',
    'Assignment',
    'FormalExpression'
  ];

  for (const element of elementsToFix) {
    const lowercaseElement = element.charAt(0).toLowerCase() + element.slice(1);
    // Fix opening tags: <bpmn:Task -> <bpmn:task
    xml = xml.replace(new RegExp(`<bpmn:${element}([ >\/])`, 'g'), `<bpmn:${lowercaseElement}$1`);
    // Fix closing tags: </bpmn:Task> -> </bpmn:task>
    xml = xml.replace(new RegExp(`</bpmn:${element}>`, 'g'), `</bpmn:${lowercaseElement}>`);
  }

  return xml;
}

/**
 * Expand multi-error boundary events into multiple BPMN-compliant boundary events.
 *
 * A single visual boundary event with errbnd:MultiErrorCodes codes="404,410,500"
 * is expanded into multiple boundary events, each catching one specific error code.
 * This is required because BPMN 2.0 only allows one errorRef per errorEventDefinition.
 */
function expandMultiErrorBoundaryEvents(xml: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    console.warn('Failed to parse XML for multi-error expansion:', parseError.textContent);
    return xml;
  }

  const BPMN_NS = 'http://www.omg.org/spec/BPMN/20100524/MODEL';
  const BPMNDI_NS = 'http://www.omg.org/spec/BPMN/20100524/DI';
  const DC_NS = 'http://www.omg.org/spec/DD/20100524/DC';
  const DI_NS = 'http://www.omg.org/spec/DD/20100524/DI';
  const ERRBND_NS = 'http://bamoe.io/schema/error-boundary';

  const definitions = doc.documentElement;
  const process = doc.querySelector('process');
  if (!process) return xml;

  // Find the BPMNPlane for DI elements
  const bpmnPlane = doc.querySelector('BPMNPlane');
  if (!bpmnPlane) return xml;

  let modified = false;

  // Find all boundaryEvent elements
  const boundaryEvents = process.querySelectorAll('boundaryEvent');

  for (const boundaryEvent of boundaryEvents) {
    // Check for errbnd:errorCodeList in extensionElements
    const extElements = boundaryEvent.querySelector('extensionElements');
    if (!extElements) continue;

    let errorCodeList: Element | null = null;
    for (const child of extElements.children) {
      if (child.localName === 'errorCodeList' && child.namespaceURI === ERRBND_NS) {
        errorCodeList = child;
        break;
      }
    }
    if (!errorCodeList) continue;

    // Read error codes from errorCode children
    const codes: string[] = [];
    for (const child of errorCodeList.children) {
      if (child.localName === 'errorCode' && child.namespaceURI === ERRBND_NS) {
        const code = child.getAttribute('code') || '';
        if (/^\d{3}$/.test(code)) {
          codes.push(code);
        }
      }
    }

    // Read targetVariable from the errorCodeList
    const targetVariable = errorCodeList.getAttribute('targetVariable') || '';

    // Single code or empty - no expansion needed (unless targetVariable is set)
    if (codes.length <= 1 && !targetVariable) continue;
    if (codes.length === 0) continue;

    const originalId = boundaryEvent.getAttribute('id') || '';
    const attachedToRef = boundaryEvent.getAttribute('attachedToRef') || '';

    // Get the outgoing sequence flow from the original boundary event
    const outgoingEl = boundaryEvent.querySelector('outgoing');
    const outgoingFlowId = outgoingEl?.textContent?.trim() || '';

    // Find the original sequence flow element
    let originalFlow: Element | null = null;
    let targetRef = '';
    if (outgoingFlowId) {
      const flows = process.querySelectorAll('sequenceFlow');
      for (const flow of flows) {
        if (flow.getAttribute('id') === outgoingFlowId) {
          originalFlow = flow;
          targetRef = flow.getAttribute('targetRef') || '';
          break;
        }
      }
    }

    // Ensure bpmn:error exists for the first code and set errorRef
    const errEvtDef = boundaryEvent.querySelector('errorEventDefinition');
    if (!errEvtDef) continue;

    // For the first code, ensure error element exists
    const firstCode = codes[0];
    let firstErrorId = ensureErrorElement(doc, definitions, process, firstCode, BPMN_NS);
    errEvtDef.setAttribute('errorRef', firstErrorId);

    // Determine if we need a converge gateway (multiple codes with targetVariable)
    const needsConvergeGateway = targetVariable && codes.length > 1;
    // The target for script tasks: either the converge gateway or the original target
    const scriptFlowTarget = needsConvergeGateway ? `${originalId}_converge` : targetRef;

    // If targetVariable is set, insert a script task on the original (first code) path
    if (targetVariable && originalFlow && targetRef) {
      const scriptTaskId = `${originalId}_script_${firstCode}`;
      const scriptFlowId = `${outgoingFlowId}_to_target`;

      // Create script task
      const scriptTask = doc.createElementNS(BPMN_NS, 'bpmn:scriptTask');
      scriptTask.setAttribute('id', scriptTaskId);
      scriptTask.setAttribute('name', `Set ${firstCode}`);
      scriptTask.setAttribute('scriptFormat', 'java');

      const incomingEl = doc.createElementNS(BPMN_NS, 'bpmn:incoming');
      incomingEl.textContent = outgoingFlowId;
      scriptTask.appendChild(incomingEl);

      const outgoingScriptEl = doc.createElementNS(BPMN_NS, 'bpmn:outgoing');
      outgoingScriptEl.textContent = scriptFlowId;
      scriptTask.appendChild(outgoingScriptEl);

      const scriptEl = doc.createElementNS(BPMN_NS, 'bpmn:script');
      scriptEl.textContent = `kcontext.setVariable("${targetVariable}", "${firstCode}");`;
      scriptTask.appendChild(scriptEl);

      process.appendChild(scriptTask);

      // Retarget the original flow to point to the script task instead of the original target
      originalFlow.setAttribute('targetRef', scriptTaskId);

      // Remove the old incoming reference from the original target for this flow
      const originalTarget = findProcessElement(process, targetRef);
      if (originalTarget) {
        for (const child of Array.from(originalTarget.children)) {
          if (child.localName === 'incoming' && child.textContent?.trim() === outgoingFlowId) {
            originalTarget.removeChild(child);
            break;
          }
        }
      }

      // Create new flow from script task to the target (converge gateway or original target)
      const newFlow = doc.createElementNS(BPMN_NS, 'bpmn:sequenceFlow');
      newFlow.setAttribute('id', scriptFlowId);
      newFlow.setAttribute('sourceRef', scriptTaskId);
      newFlow.setAttribute('targetRef', scriptFlowTarget);
      process.appendChild(newFlow);

      // If not using converge gateway, add incoming reference on the original target
      if (!needsConvergeGateway && originalTarget) {
        const newIncoming = doc.createElementNS(BPMN_NS, 'bpmn:incoming');
        newIncoming.textContent = scriptFlowId;
        const firstNonFlow = findFirstNonFlowChild(originalTarget);
        if (firstNonFlow) {
          originalTarget.insertBefore(newIncoming, firstNonFlow);
        } else {
          originalTarget.appendChild(newIncoming);
        }
      }

      // Add DI for the script task (position it between boundary event and target)
      const originalShape = findBPMNShape(bpmnPlane, originalId);
      const targetShape = findBPMNShape(bpmnPlane, targetRef);
      if (originalShape) {
        const origBounds = originalShape.querySelector('Bounds');
        const targetBounds = targetShape?.querySelector('Bounds');
        const ox = parseFloat(origBounds?.getAttribute('x') || '0');
        const oy = parseFloat(origBounds?.getAttribute('y') || '0');
        const tx = targetBounds ? parseFloat(targetBounds.getAttribute('x') || '0') : ox;
        const ty = targetBounds ? parseFloat(targetBounds.getAttribute('y') || '0') : oy + 80;
        const midX = (ox + tx) / 2 - 50;
        const midY = (oy + 36 + ty) / 2 - 40;

        const scriptShape = doc.createElementNS(BPMNDI_NS, 'bpmndi:BPMNShape');
        scriptShape.setAttribute('id', `${scriptTaskId}_di`);
        scriptShape.setAttribute('bpmnElement', scriptTaskId);
        const bounds = doc.createElementNS(DC_NS, 'dc:Bounds');
        bounds.setAttribute('x', String(midX));
        bounds.setAttribute('y', String(midY));
        bounds.setAttribute('width', '100');
        bounds.setAttribute('height', '80');
        scriptShape.appendChild(bounds);
        bpmnPlane.appendChild(scriptShape);
      }

      // Add DI edge for the new flow (script task -> target or gateway)
      const originalEdge = findBPMNEdge(bpmnPlane, outgoingFlowId);
      if (originalEdge) {
        const newEdge = doc.createElementNS(BPMNDI_NS, 'bpmndi:BPMNEdge');
        newEdge.setAttribute('id', `${scriptFlowId}_di`);
        newEdge.setAttribute('bpmnElement', scriptFlowId);
        const waypoints = originalEdge.querySelectorAll('waypoint');
        for (const wp of waypoints) {
          const newWp = doc.createElementNS(DI_NS, 'di:waypoint');
          newWp.setAttribute('x', wp.getAttribute('x') || '0');
          newWp.setAttribute('y', wp.getAttribute('y') || '0');
          newEdge.appendChild(newWp);
        }
        bpmnPlane.appendChild(newEdge);
      }

      modified = true;
    }

    // For each additional code, create cloned boundary event + sequence flow + DI
    for (let i = 1; i < codes.length; i++) {
      const code = codes[i];
      const clonedEventId = `${originalId}_err_${code}`;
      const clonedFlowId = `${outgoingFlowId}_err_${code}`;

      // Ensure bpmn:error element exists for this code
      const errorId = ensureErrorElement(doc, definitions, process, code, BPMN_NS);

      // Clone the boundary event
      const clonedEvent = boundaryEvent.cloneNode(true) as Element;
      clonedEvent.setAttribute('id', clonedEventId);

      // Update the errorEventDefinition errorRef on the clone
      const clonedErrDef = clonedEvent.querySelector('errorEventDefinition');
      if (clonedErrDef) {
        clonedErrDef.setAttribute('id', `ErrorEventDefinition_${code}_${originalId}`);
        clonedErrDef.setAttribute('errorRef', errorId);
      }

      // Determine the flow target for this cloned event
      let clonedFlowTarget = targetRef;

      // If targetVariable is set, insert a script task for this code too
      if (targetVariable && targetRef) {
        const scriptTaskId = `${originalId}_script_${code}`;
        const scriptFlowId = `${clonedFlowId}_to_target`;

        // Create script task
        const scriptTask = doc.createElementNS(BPMN_NS, 'bpmn:scriptTask');
        scriptTask.setAttribute('id', scriptTaskId);
        scriptTask.setAttribute('name', `Set ${code}`);
        scriptTask.setAttribute('scriptFormat', 'java');

        const stIncoming = doc.createElementNS(BPMN_NS, 'bpmn:incoming');
        stIncoming.textContent = clonedFlowId;
        scriptTask.appendChild(stIncoming);

        const stOutgoing = doc.createElementNS(BPMN_NS, 'bpmn:outgoing');
        stOutgoing.textContent = scriptFlowId;
        scriptTask.appendChild(stOutgoing);

        const scriptEl = doc.createElementNS(BPMN_NS, 'bpmn:script');
        scriptEl.textContent = `kcontext.setVariable("${targetVariable}", "${code}");`;
        scriptTask.appendChild(scriptEl);

        process.appendChild(scriptTask);

        // The cloned boundary event flow will target the script task
        clonedFlowTarget = scriptTaskId;

        // Create flow from script task to converge gateway or original target
        const scriptToTargetFlow = doc.createElementNS(BPMN_NS, 'bpmn:sequenceFlow');
        scriptToTargetFlow.setAttribute('id', scriptFlowId);
        scriptToTargetFlow.setAttribute('sourceRef', scriptTaskId);
        scriptToTargetFlow.setAttribute('targetRef', scriptFlowTarget);
        process.appendChild(scriptToTargetFlow);

        // If not using converge gateway, add incoming reference on the target
        if (!needsConvergeGateway) {
          const targetElement = findProcessElement(process, targetRef);
          if (targetElement) {
            const newIncoming = doc.createElementNS(BPMN_NS, 'bpmn:incoming');
            newIncoming.textContent = scriptFlowId;
            const firstNonFlow = findFirstNonFlowChild(targetElement);
            if (firstNonFlow) {
              targetElement.insertBefore(newIncoming, firstNonFlow);
            } else {
              targetElement.appendChild(newIncoming);
            }
          }
        }

        // Add DI for this script task
        const originalShape = findBPMNShape(bpmnPlane, originalId);
        if (originalShape) {
          const origBounds = originalShape.querySelector('Bounds');
          const ox = parseFloat(origBounds?.getAttribute('x') || '0');
          const oy = parseFloat(origBounds?.getAttribute('y') || '0');

          const scriptShape = doc.createElementNS(BPMNDI_NS, 'bpmndi:BPMNShape');
          scriptShape.setAttribute('id', `${scriptTaskId}_di`);
          scriptShape.setAttribute('bpmnElement', scriptTaskId);
          const bounds = doc.createElementNS(DC_NS, 'dc:Bounds');
          bounds.setAttribute('x', String(ox));
          bounds.setAttribute('y', String(oy));
          bounds.setAttribute('width', '100');
          bounds.setAttribute('height', '80');
          scriptShape.appendChild(bounds);
          bpmnPlane.appendChild(scriptShape);
        }

        // Add DI edge for script-to-target flow
        const originalEdge = findBPMNEdge(bpmnPlane, outgoingFlowId);
        if (originalEdge) {
          const scriptEdge = doc.createElementNS(BPMNDI_NS, 'bpmndi:BPMNEdge');
          scriptEdge.setAttribute('id', `${scriptFlowId}_di`);
          scriptEdge.setAttribute('bpmnElement', scriptFlowId);
          const waypoints = originalEdge.querySelectorAll('waypoint');
          for (const wp of waypoints) {
            const newWp = doc.createElementNS(DI_NS, 'di:waypoint');
            newWp.setAttribute('x', wp.getAttribute('x') || '0');
            newWp.setAttribute('y', wp.getAttribute('y') || '0');
            scriptEdge.appendChild(newWp);
          }
          bpmnPlane.appendChild(scriptEdge);
        }
      }

      // Update outgoing reference on the clone
      const clonedOutgoing = clonedEvent.querySelector('outgoing');
      if (clonedOutgoing) {
        clonedOutgoing.textContent = clonedFlowId;
      }

      // Remove errbnd:errorCodeList from cloned event (preserve on original only)
      const clonedExt = clonedEvent.querySelector('extensionElements');
      if (clonedExt) {
        for (const child of Array.from(clonedExt.children)) {
          if (child.localName === 'errorCodeList' && child.namespaceURI === ERRBND_NS) {
            clonedExt.removeChild(child);
          }
        }
        // Remove extensionElements if empty
        if (clonedExt.children.length === 0) {
          clonedEvent.removeChild(clonedExt);
        }
      }

      // Add cloned boundary event to process
      process.appendChild(clonedEvent);

      // Clone the sequence flow if it exists
      if (originalFlow && targetRef) {
        const clonedFlow = doc.createElementNS(BPMN_NS, 'bpmn:sequenceFlow');
        clonedFlow.setAttribute('id', clonedFlowId);
        clonedFlow.setAttribute('sourceRef', clonedEventId);
        clonedFlow.setAttribute('targetRef', clonedFlowTarget);
        process.appendChild(clonedFlow);

        // If targeting the original target (no script task), add incoming
        if (!targetVariable) {
          const targetElement = findProcessElement(process, targetRef);
          if (targetElement) {
            const incomingEl = doc.createElementNS(BPMN_NS, 'bpmn:incoming');
            incomingEl.textContent = clonedFlowId;
            const firstNonFlow = findFirstNonFlowChild(targetElement);
            if (firstNonFlow) {
              targetElement.insertBefore(incomingEl, firstNonFlow);
            } else {
              targetElement.appendChild(incomingEl);
            }
          }
        }
      }

      // Add BPMNShape for the cloned boundary event (same position as original)
      const originalShape = findBPMNShape(bpmnPlane, originalId);
      if (originalShape) {
        const clonedShape = doc.createElementNS(BPMNDI_NS, 'bpmndi:BPMNShape');
        clonedShape.setAttribute('id', `${clonedEventId}_di`);
        clonedShape.setAttribute('bpmnElement', clonedEventId);

        const originalBounds = originalShape.querySelector('Bounds');
        if (originalBounds) {
          const bounds = doc.createElementNS(DC_NS, 'dc:Bounds');
          bounds.setAttribute('x', originalBounds.getAttribute('x') || '0');
          bounds.setAttribute('y', originalBounds.getAttribute('y') || '0');
          bounds.setAttribute('width', originalBounds.getAttribute('width') || '36');
          bounds.setAttribute('height', originalBounds.getAttribute('height') || '36');
          clonedShape.appendChild(bounds);
        }

        bpmnPlane.appendChild(clonedShape);
      }

      // Add BPMNEdge for the cloned sequence flow
      if (originalFlow) {
        const originalEdge = findBPMNEdge(bpmnPlane, outgoingFlowId);
        if (originalEdge) {
          const clonedEdge = doc.createElementNS(BPMNDI_NS, 'bpmndi:BPMNEdge');
          clonedEdge.setAttribute('id', `${clonedFlowId}_di`);
          clonedEdge.setAttribute('bpmnElement', clonedFlowId);

          // Copy waypoints from original edge
          const waypoints = originalEdge.querySelectorAll('waypoint');
          for (const wp of waypoints) {
            const newWp = doc.createElementNS(DI_NS, 'di:waypoint');
            newWp.setAttribute('x', wp.getAttribute('x') || '0');
            newWp.setAttribute('y', wp.getAttribute('y') || '0');
            clonedEdge.appendChild(newWp);
          }

          bpmnPlane.appendChild(clonedEdge);
        }
      }

      modified = true;
    }

    // After creating all script tasks and cloned events, create the converge gateway
    if (needsConvergeGateway && targetRef) {
      const gatewayId = `${originalId}_converge`;
      const gatewayOutFlowId = `${originalId}_converge_out`;

      // Collect all script task _to_target flow IDs as incoming to the gateway
      const gatewayIncomingFlowIds: string[] = [];
      gatewayIncomingFlowIds.push(`${outgoingFlowId}_to_target`); // first code's script flow
      for (let i = 1; i < codes.length; i++) {
        const clonedFlowId = `${outgoingFlowId}_err_${codes[i]}`;
        gatewayIncomingFlowIds.push(`${clonedFlowId}_to_target`);
      }

      // Create the converging exclusive gateway
      const gateway = doc.createElementNS(BPMN_NS, 'bpmn:exclusiveGateway');
      gateway.setAttribute('id', gatewayId);
      gateway.setAttribute('gatewayDirection', 'Converging');

      for (const flowId of gatewayIncomingFlowIds) {
        const inEl = doc.createElementNS(BPMN_NS, 'bpmn:incoming');
        inEl.textContent = flowId;
        gateway.appendChild(inEl);
      }

      const gwOutgoing = doc.createElementNS(BPMN_NS, 'bpmn:outgoing');
      gwOutgoing.textContent = gatewayOutFlowId;
      gateway.appendChild(gwOutgoing);

      process.appendChild(gateway);

      // Create outgoing flow from gateway to original target
      const gatewayOutFlow = doc.createElementNS(BPMN_NS, 'bpmn:sequenceFlow');
      gatewayOutFlow.setAttribute('id', gatewayOutFlowId);
      gatewayOutFlow.setAttribute('sourceRef', gatewayId);
      gatewayOutFlow.setAttribute('targetRef', targetRef);
      process.appendChild(gatewayOutFlow);

      // Add incoming reference on the original target for the gateway flow
      const originalTarget = findProcessElement(process, targetRef);
      if (originalTarget) {
        const gwIncoming = doc.createElementNS(BPMN_NS, 'bpmn:incoming');
        gwIncoming.textContent = gatewayOutFlowId;
        const firstNonFlow = findFirstNonFlowChild(originalTarget);
        if (firstNonFlow) {
          originalTarget.insertBefore(gwIncoming, firstNonFlow);
        } else {
          originalTarget.appendChild(gwIncoming);
        }
      }

      // Add DI for the converge gateway (position between script tasks and target)
      const originalShape = findBPMNShape(bpmnPlane, originalId);
      const targetShape = findBPMNShape(bpmnPlane, targetRef);
      if (originalShape) {
        const origBounds = originalShape.querySelector('Bounds');
        const targetBounds = targetShape?.querySelector('Bounds');
        const ox = parseFloat(origBounds?.getAttribute('x') || '0');
        const oy = parseFloat(origBounds?.getAttribute('y') || '0');
        const tx = targetBounds ? parseFloat(targetBounds.getAttribute('x') || '0') : ox;
        const ty = targetBounds ? parseFloat(targetBounds.getAttribute('y') || '0') : oy + 120;
        // Position gateway between script tasks and target
        const gwX = (ox + tx) / 2 - 25;
        const gwY = (oy + 36 + ty) / 2;

        const gwShape = doc.createElementNS(BPMNDI_NS, 'bpmndi:BPMNShape');
        gwShape.setAttribute('id', `${gatewayId}_di`);
        gwShape.setAttribute('bpmnElement', gatewayId);
        gwShape.setAttribute('isMarkerVisible', 'true');
        const bounds = doc.createElementNS(DC_NS, 'dc:Bounds');
        bounds.setAttribute('x', String(gwX));
        bounds.setAttribute('y', String(gwY));
        bounds.setAttribute('width', '50');
        bounds.setAttribute('height', '50');
        gwShape.appendChild(bounds);
        bpmnPlane.appendChild(gwShape);
      }

      // Add DI edge for the gateway outgoing flow
      const originalEdge = findBPMNEdge(bpmnPlane, outgoingFlowId);
      if (originalEdge) {
        const gwEdge = doc.createElementNS(BPMNDI_NS, 'bpmndi:BPMNEdge');
        gwEdge.setAttribute('id', `${gatewayOutFlowId}_di`);
        gwEdge.setAttribute('bpmnElement', gatewayOutFlowId);
        const waypoints = originalEdge.querySelectorAll('waypoint');
        for (const wp of waypoints) {
          const newWp = doc.createElementNS(DI_NS, 'di:waypoint');
          newWp.setAttribute('x', wp.getAttribute('x') || '0');
          newWp.setAttribute('y', wp.getAttribute('y') || '0');
          gwEdge.appendChild(newWp);
        }
        bpmnPlane.appendChild(gwEdge);
      }
    }
  }

  if (modified) {
    // Reorder root elements again since we added new error elements
    const serializer = new XMLSerializer();
    let result = serializer.serializeToString(doc);
    result = reorderRootElements(result);
    return result;
  }

  return xml;
}

/**
 * Ensure a bpmn:error element exists at definitions level for the given error code.
 * Returns the error element's ID.
 */
function ensureErrorElement(
  doc: Document,
  definitions: Element,
  process: Element,
  errorCode: string,
  BPMN_NS: string
): string {
  // Look for existing error with this code
  for (const child of definitions.children) {
    if (child.localName === 'error') {
      const existingCode = child.getAttribute('errorCode');
      if (existingCode === errorCode) {
        return child.getAttribute('id') || '';
      }
    }
  }

  // Create new error element
  const errorId = `Error_http_${errorCode}`;
  const errorEl = doc.createElementNS(BPMN_NS, 'bpmn:error');
  errorEl.setAttribute('id', errorId);
  errorEl.setAttribute('name', `HTTP ${errorCode}`);
  errorEl.setAttribute('errorCode', errorCode);

  // Insert before process
  definitions.insertBefore(errorEl, process);

  return errorId;
}

/**
 * Find a flow element in the process by ID
 */
function findProcessElement(process: Element, id: string): Element | null {
  for (const child of process.children) {
    if (child.getAttribute('id') === id) {
      return child;
    }
  }
  return null;
}

/**
 * Find the first child that is not an incoming or outgoing element
 */
function findFirstNonFlowChild(element: Element): Element | null {
  for (const child of element.children) {
    if (child.localName !== 'incoming' && child.localName !== 'outgoing') {
      return child;
    }
  }
  return null;
}

/**
 * Find a BPMNShape element by its bpmnElement attribute
 */
function findBPMNShape(bpmnPlane: Element, bpmnElementId: string): Element | null {
  for (const child of bpmnPlane.children) {
    if (child.localName === 'BPMNShape' && child.getAttribute('bpmnElement') === bpmnElementId) {
      return child;
    }
  }
  return null;
}

/**
 * Find a BPMNEdge element by its bpmnElement attribute
 */
function findBPMNEdge(bpmnPlane: Element, bpmnElementId: string): Element | null {
  for (const child of bpmnPlane.children) {
    if (child.localName === 'BPMNEdge' && child.getAttribute('bpmnElement') === bpmnElementId) {
      return child;
    }
  }
  return null;
}

/**
 * Collapse expanded multi-error boundary events back into a single visual boundary event.
 *
 * On import, finds boundary events with errbnd:MultiErrorCodes (the "primary" events),
 * locates sibling boundary events whose IDs match {primaryId}_err_*, collects all
 * error codes, removes the clones, and updates the primary event's MultiErrorCodes.
 */
function collapseMultiErrorBoundaryEvents(xml: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    console.warn('Failed to parse XML for multi-error collapse:', parseError.textContent);
    return xml;
  }

  const ERRBND_NS = 'http://bamoe.io/schema/error-boundary';

  const process = doc.querySelector('process');
  if (!process) return xml;

  const bpmnPlane = doc.querySelector('BPMNPlane');

  let modified = false;

  // Find primary boundary events (those with errbnd:errorCodeList)
  const boundaryEvents = process.querySelectorAll('boundaryEvent');
  const primaryEvents: Element[] = [];

  for (const be of boundaryEvents) {
    const extElements = be.querySelector('extensionElements');
    if (!extElements) continue;

    for (const child of extElements.children) {
      if (child.localName === 'errorCodeList' && child.namespaceURI === ERRBND_NS) {
        primaryEvents.push(be);
        break;
      }
    }
  }

  if (primaryEvents.length === 0) return xml;

  for (const primaryEvent of primaryEvents) {
    const primaryId = primaryEvent.getAttribute('id') || '';
    if (!primaryId) continue;

    // Collect error codes: start with the primary event's errorRef code
    const allCodes: string[] = [];
    const primaryErrDef = primaryEvent.querySelector('errorEventDefinition');
    if (primaryErrDef) {
      const primaryErrorRef = primaryErrDef.getAttribute('errorRef') || '';
      if (primaryErrorRef) {
        const primaryErrorCode = findErrorCode(doc, primaryErrorRef);
        if (primaryErrorCode) {
          allCodes.push(primaryErrorCode);
        }
      }
    }

    // Find sibling boundary events matching {primaryId}_err_*
    const clonedEvents: Element[] = [];
    const clonedFlowIds: string[] = [];

    for (const be of boundaryEvents) {
      const beId = be.getAttribute('id') || '';
      if (beId.startsWith(`${primaryId}_err_`)) {
        clonedEvents.push(be);

        // Get the error code from the cloned event
        const clonedErrDef = be.querySelector('errorEventDefinition');
        if (clonedErrDef) {
          const errorRef = clonedErrDef.getAttribute('errorRef') || '';
          if (errorRef) {
            const errorCode = findErrorCode(doc, errorRef);
            if (errorCode && !allCodes.includes(errorCode)) {
              allCodes.push(errorCode);
            }
          }
        }

        // Track the outgoing sequence flow for removal
        const outgoing = be.querySelector('outgoing');
        if (outgoing?.textContent) {
          clonedFlowIds.push(outgoing.textContent.trim());
        }
      }
    }

    // Find auto-generated script tasks matching {primaryId}_script_{code}
    const scriptTaskIds: string[] = [];
    const scriptFlowIds: string[] = [];
    const scriptTaskPattern = new RegExp(`^${primaryId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_script_\\d{3}$`);

    for (const child of Array.from(process.children)) {
      const childId = child.getAttribute('id') || '';
      if (child.localName === 'scriptTask' && scriptTaskPattern.test(childId)) {
        scriptTaskIds.push(childId);
        // Collect outgoing flows from the script task
        const outgoing = child.querySelector('outgoing');
        if (outgoing?.textContent) {
          scriptFlowIds.push(outgoing.textContent.trim());
        }
      }
    }

    // Also collect the _to_target flow IDs for cloned flows
    for (const flowId of clonedFlowIds) {
      scriptFlowIds.push(`${flowId}_to_target`);
    }

    // Find the original outgoing flow from primary event
    const primaryOutgoing = primaryEvent.querySelector('outgoing');
    const primaryFlowId = primaryOutgoing?.textContent?.trim() || '';
    // Check if the original flow was retargeted to a script task
    if (primaryFlowId) {
      const toTargetFlowId = `${primaryFlowId}_to_target`;
      scriptFlowIds.push(toTargetFlowId);
    }

    // Look for auto-generated converge gateway
    const convergeGatewayId = `${primaryId}_converge`;
    const convergeGateway = findProcessElement(process, convergeGatewayId);
    const convergeOutFlowId = `${primaryId}_converge_out`;

    // If there are script tasks, we need to rewire the original flow back to the original target
    if (scriptTaskIds.length > 0 && primaryFlowId) {
      // Find where the script tasks point to (the real target)
      // With converge gateway: script → flow → gateway → flow → real target
      // Without converge gateway: script → flow → real target
      let realTargetRef = '';

      if (convergeGateway) {
        // Follow the converge gateway's outgoing flow to find the real target
        for (const flow of process.querySelectorAll('sequenceFlow')) {
          if (flow.getAttribute('id') === convergeOutFlowId) {
            realTargetRef = flow.getAttribute('targetRef') || '';
            break;
          }
        }
      } else {
        // No converge gateway - follow script task outgoing flows directly
        for (const stId of scriptTaskIds) {
          for (const child of process.children) {
            if (child.getAttribute('id') === stId) {
              const stOutgoing = child.querySelector('outgoing');
              if (stOutgoing?.textContent) {
                const stFlowId = stOutgoing.textContent.trim();
                for (const flow of process.querySelectorAll('sequenceFlow')) {
                  if (flow.getAttribute('id') === stFlowId) {
                    realTargetRef = flow.getAttribute('targetRef') || '';
                    break;
                  }
                }
              }
              if (realTargetRef) break;
            }
          }
          if (realTargetRef) break;
        }
      }

      // Retarget the original flow back to the real target
      if (realTargetRef) {
        for (const flow of process.querySelectorAll('sequenceFlow')) {
          if (flow.getAttribute('id') === primaryFlowId) {
            flow.setAttribute('targetRef', realTargetRef);
            break;
          }
        }
        // Add incoming reference for the original flow on the target
        const targetEl = findProcessElement(process, realTargetRef);
        if (targetEl) {
          // Remove the converge gateway's outgoing flow incoming reference if present
          if (convergeGateway) {
            for (const incoming of Array.from(targetEl.querySelectorAll('incoming'))) {
              if (incoming.textContent?.trim() === convergeOutFlowId) {
                targetEl.removeChild(incoming);
              }
            }
          }
          const hasIncoming = Array.from(targetEl.querySelectorAll('incoming')).some(
            el => el.textContent?.trim() === primaryFlowId
          );
          if (!hasIncoming) {
            const incomingEl = doc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:incoming');
            incomingEl.textContent = primaryFlowId;
            const firstNonFlow = findFirstNonFlowChild(targetEl);
            if (firstNonFlow) {
              targetEl.insertBefore(incomingEl, firstNonFlow);
            } else {
              targetEl.appendChild(incomingEl);
            }
          }
        }
      }
    }

    // Remove the converge gateway and its outgoing flow
    if (convergeGateway) {
      process.removeChild(convergeGateway);
      // Remove the gateway's outgoing sequence flow
      for (const flow of Array.from(process.querySelectorAll('sequenceFlow'))) {
        if (flow.getAttribute('id') === convergeOutFlowId) {
          process.removeChild(flow);
          break;
        }
      }
    }

    const hasClonedOrScripts = clonedEvents.length > 0 || scriptTaskIds.length > 0 || convergeGateway;
    if (!hasClonedOrScripts) continue;

    // Remove cloned boundary events
    for (const cloned of clonedEvents) {
      process.removeChild(cloned);
    }

    // Remove auto-generated script tasks
    for (const stId of scriptTaskIds) {
      const el = findProcessElement(process, stId);
      if (el) {
        process.removeChild(el);
      }
    }

    // Remove cloned sequence flows
    for (const flowId of clonedFlowIds) {
      const flows = process.querySelectorAll('sequenceFlow');
      for (const flow of flows) {
        if (flow.getAttribute('id') === flowId) {
          process.removeChild(flow);
          break;
        }
      }

      // Remove incoming references to cloned flows from target elements
      for (const child of process.children) {
        const incomings = child.querySelectorAll('incoming');
        for (const incoming of incomings) {
          if (incoming.textContent?.trim() === flowId) {
            child.removeChild(incoming);
          }
        }
      }
    }

    // Remove script task flows (both _to_target and cloned _to_target)
    for (const flowId of scriptFlowIds) {
      for (const flow of Array.from(process.querySelectorAll('sequenceFlow'))) {
        if (flow.getAttribute('id') === flowId) {
          process.removeChild(flow);
          break;
        }
      }
      // Remove incoming references
      for (const child of process.children) {
        const incomings = child.querySelectorAll('incoming');
        for (const incoming of incomings) {
          if (incoming.textContent?.trim() === flowId) {
            child.removeChild(incoming);
          }
        }
      }
    }

    // Remove cloned, script task, and converge gateway DI elements
    if (bpmnPlane) {
      const diElementsToRemove: Element[] = [];
      const idsToRemoveDI = new Set<string>();
      for (const cloned of clonedEvents) {
        idsToRemoveDI.add(cloned.getAttribute('id') || '');
      }
      for (const flowId of clonedFlowIds) {
        idsToRemoveDI.add(flowId);
      }
      for (const stId of scriptTaskIds) {
        idsToRemoveDI.add(stId);
      }
      for (const sfId of scriptFlowIds) {
        idsToRemoveDI.add(sfId);
      }
      // Add converge gateway and its outgoing flow
      if (convergeGateway) {
        idsToRemoveDI.add(convergeGatewayId);
        idsToRemoveDI.add(convergeOutFlowId);
      }

      for (const child of bpmnPlane.children) {
        const bpmnElement = child.getAttribute('bpmnElement') || '';
        if (idsToRemoveDI.has(bpmnElement)) {
          diElementsToRemove.push(child);
        }
      }
      for (const el of diElementsToRemove) {
        bpmnPlane.removeChild(el);
      }
    }

    // Update the primary event's ErrorCodeList with all collected codes as ErrorCode children
    const extElements = primaryEvent.querySelector('extensionElements');
    if (extElements) {
      for (const child of extElements.children) {
        if (child.localName === 'errorCodeList' && child.namespaceURI === ERRBND_NS) {
          // Remove existing errorCode children
          const existingChildren = Array.from(child.children);
          for (const ec of existingChildren) {
            if (ec.localName === 'errorCode' && ec.namespaceURI === ERRBND_NS) {
              child.removeChild(ec);
            }
          }
          // Add new errorCode children for each collected code
          for (const code of allCodes) {
            const errorCodeEl = doc.createElementNS(ERRBND_NS, 'errbnd:errorCode');
            errorCodeEl.setAttribute('code', code);
            child.appendChild(errorCodeEl);
          }
          break;
        }
      }
    }

    modified = true;
  }

  if (modified) {
    const serializer = new XMLSerializer();
    return serializer.serializeToString(doc);
  }

  return xml;
}

/**
 * Find the errorCode for a given error element ID
 */
function findErrorCode(doc: Document, errorId: string): string {
  const definitions = doc.documentElement;
  for (const child of definitions.children) {
    if (child.localName === 'error' && child.getAttribute('id') === errorId) {
      return child.getAttribute('errorCode') || '';
    }
  }
  return '';
}

/**
 * Returns an empty BPMN diagram XML
 */
function getEmptyDiagram(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  xmlns:drools="http://www.jboss.org/drools"
                  xmlns:bamoe="http://bamoe.io/schema/process"
                  id="Definitions_empty"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="true" />
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1" />
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
}
