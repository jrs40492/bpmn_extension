/**
 * Custom Palette Provider for Kafka Task
 * Adds Kafka Producer and Consumer task entries to the modeler palette
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
}

interface Moddle {
  create: (type: string, attrs?: Record<string, unknown>) => ModdleElement;
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

      // Create extension elements container
      const extensionElements = moddle.create('bpmn:ExtensionElements', {
        values: [kafkaConfig]
      });

      // Create the send task business object
      const businessObject = moddle.create('bpmn:SendTask', {
        name: 'Kafka Publish',
        extensionElements: extensionElements
      });

      // Link the extension elements back to the business object
      extensionElements.$parent = businessObject;
      kafkaConfig.$parent = extensionElements;

      const shape = elementFactory.createShape({
        type: 'bpmn:SendTask',
        businessObject: businessObject
      });

      create.start(event, shape);
    }

    function createKafkaConsumerTask(event: Event): void {
      // Create the Kafka task configuration using moddle
      const kafkaConfig = moddle.create('kafka:KafkaTaskConfig', {
        topic: 'my-topic',
        bootstrapServers: 'localhost:9092',
        operation: 'consume',
        groupId: 'my-consumer-group',
        autoOffsetReset: 'earliest',
        timeout: 30000,
        responseVariable: 'kafkaMessage'
      });

      // Create extension elements container
      const extensionElements = moddle.create('bpmn:ExtensionElements', {
        values: [kafkaConfig]
      });

      // Create the receive task business object
      const businessObject = moddle.create('bpmn:ReceiveTask', {
        name: 'Kafka Consume',
        extensionElements: extensionElements
      });

      // Link the extension elements back to the business object
      extensionElements.$parent = businessObject;
      kafkaConfig.$parent = extensionElements;

      const shape = elementFactory.createShape({
        type: 'bpmn:ReceiveTask',
        businessObject: businessObject
      });

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
      },
      'create.kafka-consumer-task': {
        group: 'activity',
        className: 'bpmn-icon-receive-task kafka-consumer-icon',
        title: 'Create Kafka Consumer Task',
        action: {
          dragstart: createKafkaConsumerTask,
          click: createKafkaConsumerTask
        }
      }
    };
  }
}
