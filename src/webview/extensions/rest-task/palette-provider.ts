/**
 * Custom Palette Provider for REST Task
 * Creates a Kogito-compatible REST work item using STANDARD BPMN elements only.
 *
 * NO CUSTOM EXTENSIONS - uses only:
 * - bpmn:task with drools:taskName="Rest" attribute
 * - bpmn:ioSpecification with dataInput/dataOutput
 * - bpmn:dataInputAssociation with assignments
 * - bpmn:dataOutputAssociation for result mapping
 *
 * This is compatible with:
 * - Kogito/Drools runtime (uses built-in RESTWorkItemHandler)
 * - Any standard BPMN editor
 * - IBM BAMOE editor
 */

interface PaletteEntry {
  group: string;
  className: string;
  title: string;
  action: {
    dragstart: (event: Event) => void;
    click: (event: Event) => void;
  };
}

interface ElementFactory {
  createShape: (attrs: Record<string, unknown>) => unknown;
}

interface Create {
  start: (event: Event, shape: unknown) => void;
}

interface BpmnFactory {
  create: (type: string, attrs?: Record<string, unknown>) => unknown;
}

interface ModdleElement {
  $parent?: ModdleElement;
  $type?: string;
  id?: string;
  [key: string]: unknown;
}

/**
 * Kogito REST WorkItemHandler expected parameters
 */
export const REST_PARAMS = {
  inputs: ['Url', 'Method', 'ContentType', 'Content', 'ConnectTimeout', 'ReadTimeout'],
  outputs: ['Result']
} as const;

/**
 * Default values for REST task
 */
const DEFAULT_CONFIG = {
  Url: 'https://api.example.com/endpoint',
  Method: 'GET',
  ContentType: 'application/json',
  Content: '',
  ConnectTimeout: '30000',
  ReadTimeout: '30000'
};

export default class RestTaskPaletteProvider {
  static $inject = ['palette', 'create', 'elementFactory', 'bpmnFactory'];

  private create: Create;
  private elementFactory: ElementFactory;
  private bpmnFactory: BpmnFactory;

  constructor(
    palette: { registerProvider: (provider: RestTaskPaletteProvider) => void },
    create: Create,
    elementFactory: ElementFactory,
    bpmnFactory: BpmnFactory
  ) {
    this.create = create;
    this.elementFactory = elementFactory;
    this.bpmnFactory = bpmnFactory;

    palette.registerProvider(this);
  }

  getPaletteEntries(): Record<string, PaletteEntry> {
    const create = this.create;
    const elementFactory = this.elementFactory;
    const bpmnFactory = this.bpmnFactory;

    function createRestTask(event: Event): void {
      try {
        // Let bpmn-js create the shape normally - this ensures proper serialization
        const shape = elementFactory.createShape({
          type: 'bpmn:Task'
        }) as any;

        const businessObject = shape.businessObject;
        const taskId = businessObject.id;

        // Set name and drools:taskName AFTER creation
        businessObject.name = 'REST API Call';
        businessObject.set('drools:taskName', 'Rest');

        // Create ioSpecification with data inputs/outputs
        const dataInputs = new Map<string, ModdleElement>();
        const dataOutputs = new Map<string, ModdleElement>();
        const dataInputRefs: ModdleElement[] = [];
        const dataOutputRefs: ModdleElement[] = [];

        // Create data inputs for each REST parameter (no IDs for Kogito compatibility)
        for (const paramName of REST_PARAMS.inputs) {
          const dataInput = (bpmnFactory as any).create('bpmn:DataInput', {
            id: `${taskId}_${paramName}Input`,
            name: paramName
          });
          // Set drools:dtype for Kogito compatibility
          dataInput.set('drools:dtype', 'java.lang.String');
          dataInputs.set(paramName, dataInput);
          dataInputRefs.push(dataInput);
        }

        // Create data outputs
        for (const paramName of REST_PARAMS.outputs) {
          const dataOutput = (bpmnFactory as any).create('bpmn:DataOutput', {
            id: `${taskId}_${paramName}Output`,
            name: paramName
          });
          // Set drools:dtype for Kogito compatibility
          dataOutput.set('drools:dtype', 'java.lang.String');
          dataOutputs.set(paramName, dataOutput);
          dataOutputRefs.push(dataOutput);
        }

        // Create input/output sets (no IDs for Kogito compatibility)
        const inputSet = (bpmnFactory as any).create('bpmn:InputSet', {
          dataInputRefs: dataInputRefs
        });

        const outputSet = (bpmnFactory as any).create('bpmn:OutputSet', {
          dataOutputRefs: dataOutputRefs
        });

        // Create ioSpecification (no ID for Kogito compatibility)
        const ioSpecification = (bpmnFactory as any).create('bpmn:InputOutputSpecification', {
          dataInputs: Array.from(dataInputs.values()),
          dataOutputs: Array.from(dataOutputs.values()),
          inputSets: [inputSet],
          outputSets: [outputSet]
        });

        // Set parent references for ioSpec
        dataInputs.forEach(di => { di.$parent = ioSpecification; });
        dataOutputs.forEach(dout => { dout.$parent = ioSpecification; });
        inputSet.$parent = ioSpecification;
        outputSet.$parent = ioSpecification;

        // Create data input associations with default values (no IDs for Kogito compatibility)
        const dataInputAssociations: ModdleElement[] = [];
        for (const [paramName, dataInput] of dataInputs) {
          const value = DEFAULT_CONFIG[paramName as keyof typeof DEFAULT_CONFIG] || '';

          const fromExpression = (bpmnFactory as any).create('bpmn:FormalExpression', {
            body: value
          });
          const toExpression = (bpmnFactory as any).create('bpmn:FormalExpression', {
            body: dataInput.id
          });
          const assignment = (bpmnFactory as any).create('bpmn:Assignment', {
            from: fromExpression,
            to: toExpression
          });
          // No ID on association for Kogito compatibility
          const association = (bpmnFactory as any).create('bpmn:DataInputAssociation', {
            targetRef: dataInput,
            assignment: [assignment]
          });
          dataInputAssociations.push(association);
        }

        // Create data output association with targetRef (REQUIRED by Kogito)
        // The targetRef points to a process variable name where the result will be stored
        const resultOutput = dataOutputs.get('Result')!;
        const dataOutputAssociation = (bpmnFactory as any).create('bpmn:DataOutputAssociation', {
          sourceRef: [resultOutput],
          targetRef: 'restResult'  // Maps output to 'restResult' process variable
        });

        // Set all properties on business object
        businessObject.ioSpecification = ioSpecification;
        businessObject.dataInputAssociations = dataInputAssociations;
        businessObject.dataOutputAssociations = [dataOutputAssociation];

        // Set parent references
        ioSpecification.$parent = businessObject;
        dataInputAssociations.forEach((assoc: ModdleElement) => { assoc.$parent = businessObject; });
        dataOutputAssociation.$parent = businessObject;

        create.start(event, shape);
      } catch (error) {
        console.error('Error creating REST task:', error);
        // Fallback to simple task
        const simpleShape = elementFactory.createShape({
          type: 'bpmn:Task'
        });
        create.start(event, simpleShape);
      }
    }

    return {
      'create.rest-task': {
        group: 'activity',
        className: 'bpmn-icon-task rest-task-icon',
        title: 'Create REST API Task',
        action: {
          dragstart: createRestTask,
          click: createRestTask
        }
      }
    };
  }
}

/**
 * Helper functions for reading/writing REST task configuration
 * Used by properties panel and rest-panel
 */

/**
 * Check if an element is a REST task
 */
export function isRestTask(element: any): boolean {
  if (!element?.businessObject) return false;
  const bo = element.businessObject;
  if (bo.$type !== 'bpmn:Task') return false;

  // Check for drools:taskName="Rest"
  const taskName = bo.get?.('drools:taskName') || bo['drools:taskName'];
  return taskName === 'Rest';
}

/**
 * Get REST configuration from standard BPMN data input associations
 */
export function getRestConfig(element: any): Record<string, string> | null {
  if (!isRestTask(element)) return null;

  const bo = element.businessObject;
  const config: Record<string, string> = {};

  // Read from dataInputAssociations
  const associations = bo.dataInputAssociations || [];
  for (const assoc of associations) {
    const targetRef = assoc.targetRef;
    if (!targetRef) continue;

    const paramName = targetRef.name;
    if (!paramName) continue;

    // Get value from assignment
    const assignment = assoc.assignment?.[0];
    if (assignment?.from?.body !== undefined) {
      config[paramName] = assignment.from.body;
    }
  }

  // Read result variable from output association
  const outputAssoc = bo.dataOutputAssociations?.[0];
  if (outputAssoc) {
    config['ResultVariable'] = (outputAssoc as any).targetVariable || 'restResult';
  }

  return config;
}

/**
 * Update a REST configuration parameter
 */
export function updateRestParam(element: any, paramName: string, value: string, modeling: any): void {
  const bo = element.businessObject;
  const associations = bo.dataInputAssociations || [];

  for (const assoc of associations) {
    const targetRef = assoc.targetRef;
    if (targetRef?.name === paramName) {
      const assignment = assoc.assignment?.[0];
      if (assignment?.from) {
        assignment.from.body = value;
        modeling.updateProperties(element, {});
        return;
      }
    }
  }
}
