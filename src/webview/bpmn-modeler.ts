import BpmnModeler from 'bpmn-js/lib/Modeler';

// @ts-expect-error - no type definitions available
import { BpmnPropertiesPanelModule, BpmnPropertiesProviderModule } from 'bpmn-js-properties-panel';
// @ts-expect-error - no type definitions available
import minimapModule from 'diagram-js-minimap';
// @ts-expect-error - no type definitions available
import gridModule from 'diagram-js-grid';
// @ts-expect-error - no type definitions available
import tokenSimulationModule from 'bpmn-js-token-simulation';

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
    restTaskModule,
    kafkaTaskModule,
    scriptTaskModule,
    businessRuleTaskModule,
    processVariablesModule,
    eventColorsModule,
    compensationTaskModule,
    tokenSimulationModule
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
      drools: droolsDescriptor
    },
    propertiesPanel: propertiesContainer ? {
      parent: propertiesContainer
    } : undefined,
    minimap: {
      open: false
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

  // Fix DataOutputAssociations missing targetRef
  const outputAssocs = doc.querySelectorAll('dataOutputAssociation, DataOutputAssociation');
  for (const assoc of outputAssocs) {
    const sourceRef = assoc.querySelector('sourceRef');
    const targetRef = assoc.querySelector('targetRef');

    if (sourceRef && !targetRef) {
      // Missing targetRef - add a default one based on the output name
      const sourceId = sourceRef.textContent || '';
      // Extract variable name from sourceId (e.g., "Activity_05jwo4m_ResultOutput" -> "result")
      let varName = 'result';
      if (sourceId.includes('_')) {
        const parts = sourceId.split('_');
        const outputName = parts[parts.length - 1].replace('Output', '');
        varName = outputName.toLowerCase() || 'result';
      }

      const targetRefElem = doc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:targetRef');
      targetRefElem.textContent = varName;
      assoc.appendChild(targetRefElem);
      modified = true;
      console.log(`Fixed DataOutputAssociation: added targetRef="${varName}"`);
    }
  }

  // Fix DataInputAssociations that have targetRef but no sourceRef and no assignment
  // These are meant to map process variables to task inputs
  const inputAssocs = doc.querySelectorAll('dataInputAssociation, DataInputAssociation');
  for (const assoc of inputAssocs) {
    const sourceRef = assoc.querySelector('sourceRef');
    const targetRef = assoc.querySelector('targetRef');
    const assignment = assoc.querySelector('assignment, Assignment');

    // If it has targetRef but no sourceRef and no assignment, it's incomplete
    if (targetRef && !sourceRef && !assignment) {
      const targetId = targetRef.textContent || '';
      // Extract variable name from targetId (e.g., "Activity_05jwo4m_ddidInput" -> "ddid")
      let varName = 'input';
      if (targetId.includes('_')) {
        const parts = targetId.split('_');
        const inputName = parts[parts.length - 1].replace('Input', '');
        varName = inputName.toLowerCase() || 'input';
      }

      const sourceRefElem = doc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:sourceRef');
      sourceRefElem.textContent = varName;
      // Insert sourceRef before targetRef
      assoc.insertBefore(sourceRefElem, targetRef);
      modified = true;
      console.log(`Fixed DataInputAssociation: added sourceRef="${varName}"`);
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
 * 1. Add a dataInput for that variable
 * 2. Add a dataInputAssociation with sourceRef pointing to the process variable
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

  // Find all tasks with drools:taskName="Rest"
  const tasks = doc.querySelectorAll('task, Task');
  let modified = false;

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

      // Extract all {variableName} patterns
      const regex = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
      let match;
      while ((match = regex.exec(value)) !== null) {
        const varName = match[1];
        // Skip standard REST params
        if (!['Url', 'Method', 'ContentType', 'Content', 'ConnectTimeout', 'ReadTimeout', 'Result'].includes(varName)) {
          variablesNeeded.add(varName);
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

      // Create dataInputAssociation with sourceRef
      const dataInputAssoc = doc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:dataInputAssociation');

      const sourceRef = doc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:sourceRef');
      sourceRef.textContent = varName;

      const targetRefElem = doc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:targetRef');
      targetRefElem.textContent = inputId;

      dataInputAssoc.appendChild(sourceRef);
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
