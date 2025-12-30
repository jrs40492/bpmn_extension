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
      gatewayDirectionModule
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
