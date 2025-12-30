/**
 * Custom Palette Provider for REST Task
 * Adds a REST API task entry to the modeler palette
 * Generates Kogito-compatible BPMN data mappings
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
  values?: ModdleElement[];
  get?: (name: string) => unknown;
}

interface Moddle {
  create: (type: string, attrs?: Record<string, unknown>) => ModdleElement;
}

/**
 * Kogito REST WorkItemHandler parameter mapping
 * Maps our friendly property names to Kogito's expected parameter names
 */
export const KOGITO_REST_PARAMS = {
  // Input parameters (what we send to the REST handler)
  inputs: {
    url: 'Url',
    method: 'Method',
    headers: 'Headers',
    body: 'Content',
    timeout: 'ReadTimeout',
    connectTimeout: 'ConnectTimeout',
    contentType: 'ContentType',
    acceptHeader: 'AcceptHeader',
    username: 'Username',
    password: 'Password'
  },
  // Output parameters (what we get back)
  outputs: {
    result: 'Result',
    status: 'Status',
    statusMsg: 'StatusMsg'
  }
} as const;

/**
 * Creates Kogito-compatible ioSpecification with data inputs/outputs
 */
export function createKogitoDataMappings(
  moddle: Moddle,
  config: {
    url: string;
    method: string;
    headers: string;
    body: string;
    responseVariable: string;
    timeout: number;
  },
  taskId: string
): {
  ioSpecification: ModdleElement;
  dataInputAssociations: ModdleElement[];
  dataOutputAssociations: ModdleElement[];
} {
  const dataInputs: ModdleElement[] = [];
  const dataOutputs: ModdleElement[] = [];
  const dataInputAssociations: ModdleElement[] = [];
  const dataOutputAssociations: ModdleElement[] = [];
  const inputSet = moddle.create('bpmn:InputSet', { dataInputRefs: [] });
  const outputSet = moddle.create('bpmn:OutputSet', { dataOutputRefs: [] });

  // Create data inputs for each REST parameter
  const inputMappings = [
    { id: 'Url', value: config.url },
    { id: 'Method', value: config.method },
    { id: 'Content', value: config.body },
    { id: 'ContentType', value: 'application/json' },
    { id: 'ReadTimeout', value: String(config.timeout) },
  ];

  // Add Headers if not empty
  if (config.headers && config.headers !== '{}') {
    // Convert JSON headers to Kogito format: "header1=val1;header2=val2"
    try {
      const headersObj = JSON.parse(config.headers);
      const headersStr = Object.entries(headersObj)
        .map(([k, v]) => `${k}=${v}`)
        .join(';');
      if (headersStr) {
        inputMappings.push({ id: 'Headers', value: headersStr });
      }
    } catch {
      // If not valid JSON, use as-is
      inputMappings.push({ id: 'Headers', value: config.headers });
    }
  }

  // Create DataInput elements
  inputMappings.forEach(({ id, value }) => {
    const dataInputId = `${taskId}_${id}Input`;
    const dataInput = moddle.create('bpmn:DataInput', {
      id: dataInputId,
      name: id,
      itemSubjectRef: `${id}Item`
    });
    dataInputs.push(dataInput);
    (inputSet as any).dataInputRefs.push(dataInput);

    // Create DataInputAssociation with assignment
    const assignment = moddle.create('bpmn:Assignment', {});
    const from = moddle.create('bpmn:FormalExpression', { body: value });
    const to = moddle.create('bpmn:FormalExpression', { body: dataInputId });
    (assignment as any).from = from;
    (assignment as any).to = to;

    const dataInputAssociation = moddle.create('bpmn:DataInputAssociation', {
      id: `${taskId}_${id}InputAssociation`,
      targetRef: dataInput,
      assignment: [assignment]
    });
    dataInputAssociations.push(dataInputAssociation);
  });

  // Create TaskName input (required by Kogito to identify the handler)
  const taskNameInputId = `${taskId}_TaskNameInput`;
  const taskNameInput = moddle.create('bpmn:DataInput', {
    id: taskNameInputId,
    name: 'TaskName'
  });
  dataInputs.push(taskNameInput);
  (inputSet as any).dataInputRefs.push(taskNameInput);

  const taskNameAssignment = moddle.create('bpmn:Assignment', {});
  const taskNameFrom = moddle.create('bpmn:FormalExpression', { body: 'Rest' });
  const taskNameTo = moddle.create('bpmn:FormalExpression', { body: taskNameInputId });
  (taskNameAssignment as any).from = taskNameFrom;
  (taskNameAssignment as any).to = taskNameTo;

  const taskNameAssociation = moddle.create('bpmn:DataInputAssociation', {
    id: `${taskId}_TaskNameInputAssociation`,
    targetRef: taskNameInput,
    assignment: [taskNameAssignment]
  });
  dataInputAssociations.push(taskNameAssociation);

  // Create DataOutput for Result
  const resultOutputId = `${taskId}_ResultOutput`;
  const resultOutput = moddle.create('bpmn:DataOutput', {
    id: resultOutputId,
    name: 'Result'
  });
  dataOutputs.push(resultOutput);
  (outputSet as any).dataOutputRefs = [resultOutput];

  // Create DataOutputAssociation to map result to process variable
  if (config.responseVariable) {
    const dataOutputAssociation = moddle.create('bpmn:DataOutputAssociation', {
      id: `${taskId}_ResultOutputAssociation`,
      sourceRef: [resultOutput]
    });
    // The targetRef would be the process variable - we'll set this as an attribute
    (dataOutputAssociation as any).targetRef = config.responseVariable;
    dataOutputAssociations.push(dataOutputAssociation);
  }

  // Create ioSpecification
  const ioSpecification = moddle.create('bpmn:IoSpecification', {
    dataInputs,
    dataOutputs,
    inputSets: [inputSet],
    outputSets: [outputSet]
  });

  return {
    ioSpecification,
    dataInputAssociations,
    dataOutputAssociations
  };
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

        // Default configuration
        const config = {
          url: 'https://api.example.com/endpoint',
          method: 'GET',
          headers: '{"Content-Type": "application/json"}',
          body: '',
          responseVariable: 'response',
          timeout: 30000,
          retryCount: 0
        };

        // Create the REST task configuration using moddle (for UI state)
        const restConfig = moddle.create('rest:RestTaskConfig', config);

        // Build extension elements with REST config
        const extensionValues: ModdleElement[] = [restConfig];

        // Create extension elements container
        const extensionElements = moddle.create('bpmn:ExtensionElements', {
          values: extensionValues
        });

        // Set parent references for extension elements
        extensionElements.$parent = undefined; // Will be set after businessObject creation
        extensionValues.forEach(val => {
          val.$parent = extensionElements;
        });

        // Try to create Kogito-compatible data mappings
        let ioSpecification: ModdleElement | undefined;
        let dataInputAssociations: ModdleElement[] = [];
        let dataOutputAssociations: ModdleElement[] = [];

        try {
          const mappings = createKogitoDataMappings(moddle, config, taskId);
          ioSpecification = mappings.ioSpecification;
          dataInputAssociations = mappings.dataInputAssociations;
          dataOutputAssociations = mappings.dataOutputAssociations;
        } catch (e) {
          console.warn('Could not create Kogito data mappings:', e);
        }

        // Create the task business object (bpmn:Task, NOT bpmn:ServiceTask)
        // Kogito uses bpmn:Task with drools:taskName attribute for work item handlers
        // bpmn:ServiceTask expects WSDL interface/operation definitions
        const businessObjectAttrs: Record<string, unknown> = {
          id: taskId,
          name: 'REST API Call',
          extensionElements,
          // Set drools:taskName as an attribute on the task element
          // This is required by Kogito to identify the work item handler
          'drools:taskName': 'Rest'
        };

        // Only add ioSpecification if it was created successfully
        if (ioSpecification) {
          businessObjectAttrs.ioSpecification = ioSpecification;
          businessObjectAttrs.dataInputAssociations = dataInputAssociations;
          businessObjectAttrs.dataOutputAssociations = dataOutputAssociations;
        }

        const businessObject = moddle.create('bpmn:Task', businessObjectAttrs);

        // Set parent references
        extensionElements.$parent = businessObject;

        if (ioSpecification) {
          ioSpecification.$parent = businessObject;
          dataInputAssociations.forEach(assoc => {
            assoc.$parent = businessObject;
          });
          dataOutputAssociations.forEach(assoc => {
            assoc.$parent = businessObject;
          });
        }

        const shape = elementFactory.createShape({
          type: 'bpmn:Task',
          businessObject
        });

        create.start(event, shape);
      } catch (error) {
        console.error('Error creating REST task:', error);
        // Fallback to simple task creation
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
