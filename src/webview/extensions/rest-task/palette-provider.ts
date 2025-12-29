/**
 * Custom Palette Provider for REST Task
 * Adds a REST API task entry to the modeler palette
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

interface Moddle {
  create: (type: string, attrs?: Record<string, unknown>) => unknown;
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
      // Create the REST task configuration using moddle
      const restConfig = moddle.create('rest:RestTaskConfig', {
        url: 'https://api.example.com/endpoint',
        method: 'GET',
        headers: '{"Content-Type": "application/json"}',
        body: '',
        responseVariable: 'response',
        timeout: 30000,
        retryCount: 0
      });

      // Create extension elements container
      const extensionElements = moddle.create('bpmn:ExtensionElements', {
        values: [restConfig]
      });

      // Create the service task business object
      const businessObject = moddle.create('bpmn:ServiceTask', {
        name: 'REST API Call',
        extensionElements: extensionElements
      });

      // Link the extension elements back to the business object
      extensionElements.$parent = businessObject;
      restConfig.$parent = extensionElements;

      const shape = elementFactory.createShape({
        type: 'bpmn:ServiceTask',
        businessObject: businessObject
      });

      create.start(event, shape);
    }

    return {
      'create.rest-task': {
        group: 'activity',
        className: 'bpmn-icon-service-task rest-task-icon',
        title: 'Create REST API Task',
        action: {
          dragstart: createRestTask,
          click: createRestTask
        }
      }
    };
  }
}
