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

interface Moddle {
  create: (type: string, attrs?: Record<string, unknown>) => ModdleElement;
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

/**
 * Creates a standard BPMN ioSpecification for REST task
 */
function createRestIoSpecification(moddle: Moddle, taskId: string): {
  ioSpecification: ModdleElement;
  dataInputs: Map<string, ModdleElement>;
  dataOutputs: Map<string, ModdleElement>;
} {
  const dataInputs = new Map<string, ModdleElement>();
  const dataOutputs = new Map<string, ModdleElement>();
  const dataInputRefs: ModdleElement[] = [];
  const dataOutputRefs: ModdleElement[] = [];

  // Create data inputs for each REST parameter
  for (const paramName of REST_PARAMS.inputs) {
    const dataInput = moddle.create('bpmn:DataInput', {
      id: `${taskId}_${paramName}Input`,
      name: paramName
    });
    dataInputs.set(paramName, dataInput);
    dataInputRefs.push(dataInput);
  }

  // Create data outputs
  for (const paramName of REST_PARAMS.outputs) {
    const dataOutput = moddle.create('bpmn:DataOutput', {
      id: `${taskId}_${paramName}Output`,
      name: paramName
    });
    dataOutputs.set(paramName, dataOutput);
    dataOutputRefs.push(dataOutput);
  }

  // Create input/output sets
  const inputSet = moddle.create('bpmn:InputSet', {
    id: `${taskId}_InputSet`,
    dataInputRefs: dataInputRefs
  });

  const outputSet = moddle.create('bpmn:OutputSet', {
    id: `${taskId}_OutputSet`,
    dataOutputRefs: dataOutputRefs
  });

  // Create ioSpecification
  const ioSpecification = moddle.create('bpmn:InputOutputSpecification', {
    id: `${taskId}_IoSpec`,
    dataInputs: Array.from(dataInputs.values()),
    dataOutputs: Array.from(dataOutputs.values()),
    inputSets: [inputSet],
    outputSets: [outputSet]
  });

  // Set parent references
  dataInputs.forEach(di => { di.$parent = ioSpecification; });
  dataOutputs.forEach(dout => { dout.$parent = ioSpecification; });
  inputSet.$parent = ioSpecification;
  outputSet.$parent = ioSpecification;

  return { ioSpecification, dataInputs, dataOutputs };
}

/**
 * Creates data input associations with default values
 */
function createDataInputAssociations(
  moddle: Moddle,
  taskId: string,
  dataInputs: Map<string, ModdleElement>,
  config: Record<string, string>
): ModdleElement[] {
  const associations: ModdleElement[] = [];

  for (const [paramName, dataInput] of dataInputs) {
    const value = config[paramName] || '';

    // Create FormalExpression for the value
    const fromExpression = moddle.create('bpmn:FormalExpression', {
      body: value
    });

    // Create assignment
    const assignment = moddle.create('bpmn:Assignment', {
      from: fromExpression,
      to: moddle.create('bpmn:FormalExpression', {
        body: dataInput.id
      })
    });

    // Create data input association
    const association = moddle.create('bpmn:DataInputAssociation', {
      id: `${taskId}_${paramName}Association`,
      targetRef: dataInput,
      assignment: [assignment]
    });

    associations.push(association);
  }

  return associations;
}

/**
 * Creates data output association for Result
 */
function createDataOutputAssociation(
  moddle: Moddle,
  taskId: string,
  resultOutput: ModdleElement,
  targetVariable: string
): ModdleElement {
  // For output, we map the Result to a process variable
  // The targetRef should be a reference to a process variable (ItemAwareElement)
  const association = moddle.create('bpmn:DataOutputAssociation', {
    id: `${taskId}_ResultAssociation`,
    sourceRef: [resultOutput]
  });

  // Store target variable name for later use
  // In BPMN, this would typically reference a DataObject or Property
  // For Kogito, we'll use a simple approach
  (association as any).targetVariable = targetVariable;

  return association;
}

export default class RestTaskPaletteProvider {
  static $inject = ['palette', 'create', 'elementFactory', 'bpmnFactory', 'moddle'];

  private create: Create;
  private elementFactory: ElementFactory;
  private bpmnFactory: BpmnFactory;
  private moddle: Moddle;

  constructor(
    palette: { registerProvider: (provider: RestTaskPaletteProvider) => void },
    create: Create,
    elementFactory: ElementFactory,
    bpmnFactory: BpmnFactory,
    moddle: Moddle
  ) {
    this.create = create;
    this.elementFactory = elementFactory;
    this.bpmnFactory = bpmnFactory;
    this.moddle = moddle;

    palette.registerProvider(this);
  }

  getPaletteEntries(): Record<string, PaletteEntry> {
    const create = this.create;
    const elementFactory = this.elementFactory;
    const moddle = this.moddle;

    function createRestTask(event: Event): void {
      try {
        const taskId = `Activity_${Math.random().toString(36).substr(2, 9)}`;

        // Create ioSpecification with data inputs/outputs
        const { ioSpecification, dataInputs, dataOutputs } =
          createRestIoSpecification(moddle, taskId);

        // Create data input associations with default values
        const dataInputAssociations = createDataInputAssociations(
          moddle, taskId, dataInputs, DEFAULT_CONFIG
        );

        // Create data output association
        const resultOutput = dataOutputs.get('Result')!;
        const dataOutputAssociations = [
          createDataOutputAssociation(moddle, taskId, resultOutput, 'restResult')
        ];

        // Create the task business object
        // Using bpmn:task with drools:taskName="Rest" for Kogito compatibility
        const businessObject = moddle.create('bpmn:Task', {
          id: taskId,
          name: 'REST API Call',
          'drools:taskName': 'Rest',
          ioSpecification,
          dataInputAssociations,
          dataOutputAssociations
        });

        // Set parent references
        ioSpecification.$parent = businessObject;
        dataInputAssociations.forEach(assoc => { assoc.$parent = businessObject; });
        dataOutputAssociations.forEach(assoc => { assoc.$parent = businessObject; });

        const shape = elementFactory.createShape({
          type: 'bpmn:Task',
          businessObject
        });

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
