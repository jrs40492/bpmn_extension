/**
 * Custom Palette Provider for Kafka Task
 * Adds Kafka Producer and Consumer task entries to the modeler palette
 *
 * IMPORTANT: We let bpmn-js create the shape normally (which assigns an ID),
 * then add extension elements afterward. Passing a custom businessObject to
 * createShape() bypasses ID generation and causes persistence issues.
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
  id?: string;
  name?: string;
  extensionElements?: ModdleElement & { values?: ModdleElement[] };
  [key: string]: unknown;
}

interface Moddle {
  create: (type: string, attrs?: Record<string, unknown>) => ModdleElement;
}

interface Shape {
  businessObject: ModdleElement;
}

export default class KafkaTaskPaletteProvider {
  static $inject = ['palette', 'create', 'elementFactory', 'bpmnFactory', 'moddle'];

  private create: Create;
  private elementFactory: ElementFactory;
  private bpmnFactory: BpmnFactory;
  private moddle: Moddle;

  constructor(
    palette: { registerProvider: (provider: KafkaTaskPaletteProvider) => void },
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

    function createKafkaProducerTask(event: Event): void {
      // Let bpmn-js create the shape normally - this ensures proper ID assignment
      const shape = elementFactory.createShape({
        type: 'bpmn:SendTask'
      }) as Shape;

      const businessObject = shape.businessObject;

      // Set task name AFTER creation
      businessObject.name = 'Kafka Publish';

      // Create the Kafka task configuration using moddle
      const kafkaConfig = moddle.create('kafka:KafkaTaskConfig', {
        topic: 'my-topic',
        bootstrapServers: 'localhost:9092',
        operation: 'publish',
        keyExpression: '',
        messageExpression: '${message}',
        headers: '{}',
        acks: 'all',
        retries: 3,
        timeout: 30000,
        responseVariable: 'kafkaResponse'
      });

      // Create or get extension elements container
      let extensionElements = businessObject.extensionElements;
      if (!extensionElements) {
        extensionElements = moddle.create('bpmn:ExtensionElements', {
          values: []
        });
        extensionElements.$parent = businessObject;
        businessObject.extensionElements = extensionElements;
      }

      // Initialize values array if needed
      if (!extensionElements.values) {
        extensionElements.values = [];
      }

      // Add kafka config to extension elements
      kafkaConfig.$parent = extensionElements;
      extensionElements.values.push(kafkaConfig);

      create.start(event, shape);
    }

    return {
      'create.kafka-producer-task': {
        group: 'activity',
        className: 'bpmn-icon-send-task kafka-producer-icon',
        title: 'Create Kafka Producer Task',
        action: {
          dragstart: createKafkaProducerTask,
          click: createKafkaProducerTask
        }
      }
    };
  }
}
