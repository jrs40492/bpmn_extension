import BpmnModeler from 'bpmn-js/lib/Modeler';

// @ts-expect-error - no type definitions available
import { BpmnPropertiesPanelModule, BpmnPropertiesProviderModule } from 'bpmn-js-properties-panel';
// @ts-expect-error - no type definitions available
import minimapModule from 'diagram-js-minimap';
// @ts-expect-error - no type definitions available
import gridModule from 'diagram-js-grid';
// @ts-expect-error - no type definitions available
import tokenSimulationModule from 'bpmn-js-token-simulation';

// Custom REST task extension
import restTaskModule, { restTaskDescriptor } from './extensions/rest-task';

// Custom Kafka task extension
import kafkaTaskModule, { kafkaTaskDescriptor } from './extensions/kafka-task';

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

export interface Modeler extends BpmnModelerInstance {
  get(name: 'canvas'): Canvas;
  get(name: 'eventBus'): EventBus;
  get(name: 'elementRegistry'): ElementRegistry;
  get(name: 'selection'): Selection;
  get(name: 'toggleMode'): ToggleMode;
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
    tokenSimulationModule
  ];

  // Add properties panel if container is provided
  if (propertiesContainer) {
    additionalModules.push(
      BpmnPropertiesPanelModule,
      BpmnPropertiesProviderModule
    );
  }

  const modeler = new BpmnModeler({
    container,
    keyboard: {
      bindTo: document
    },
    additionalModules,
    moddleExtensions: {
      rest: restTaskDescriptor,
      kafka: kafkaTaskDescriptor
    },
    propertiesPanel: propertiesContainer ? {
      parent: propertiesContainer
    } : undefined,
    minimap: {
      open: true
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
  return result.xml;
}

/**
 * Returns an empty BPMN diagram XML
 */
function getEmptyDiagram(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  id="Definitions_empty"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false" />
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1" />
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
}
