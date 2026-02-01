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

// Custom Business Rule Task extension (DMN linking)
import businessRuleTaskModule, { businessRuleTaskDescriptor } from './extensions/business-rule-task';

// Custom Process Variables extension
import processVariablesModule, { processVariablesDescriptor } from './extensions/process-variables';

// Custom Message Event extension
import messageEventModule, { messageEventDescriptor } from './extensions/message-event';

// Custom event colors extension
import eventColorsModule from './extensions/event-colors';

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

interface ElementRegistry {
  getAll(): unknown[];
  get(id: string): unknown;
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
    businessRuleTaskModule,
    processVariablesModule,
    messageEventModule,
    eventColorsModule,
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
      msgevt: messageEventDescriptor
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

  const result = await modeler.importXML(xml);

  if (result.warnings && result.warnings.length > 0) {
    console.warn('BPMN import warnings:', result.warnings);
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

  // Add process variable mappings for REST tasks that use {variableName} placeholders
  xml = addRestTaskVariableMappings(xml);

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
