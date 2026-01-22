/**
 * Kafka Task Properties Provider
 * Adds custom Kafka properties to the properties panel
 */

// Helper to get Kafka config from element
function getKafkaConfig(element: any): any {
  const bo = element?.businessObject;
  if (!bo) return null;

  const extensionElements = bo.extensionElements || bo.get?.('extensionElements');
  if (!extensionElements) return null;

  const values = extensionElements.values || extensionElements.get?.('values') || [];
  return values.find((ext: any) => ext.$type === 'kafka:KafkaTaskConfig');
}

// Helper to check if element is a Kafka task
function isKafkaTask(element: any): boolean {
  if (!element?.businessObject) return false;
  const bo = element.businessObject;
  if (bo.$type !== 'bpmn:SendTask' && bo.$type !== 'bpmn:ReceiveTask' && bo.$type !== 'bpmn:ServiceTask') {
    return false;
  }
  return getKafkaConfig(element) !== null;
}

// Helper to check if element is a Kafka receive task
function isKafkaReceiveTask(element: any): boolean {
  if (!element?.businessObject) return false;
  const bo = element.businessObject;
  if (bo.$type !== 'bpmn:ReceiveTask') return false;
  return getKafkaConfig(element) !== null;
}

// Helper to get definitions (root of BPMN document)
function getDefinitions(element: any): any {
  let current = element.businessObject;
  while (current?.$parent) {
    current = current.$parent;
  }
  return current;
}

// Ensure Kafka receive task has a message reference (required by jBPM)
function ensureMessageRef(element: any, bpmnFactory: any, commandStack: any): void {
  const bo = element.businessObject;
  if (bo.$type !== 'bpmn:ReceiveTask' || bo.messageRef) return;

  const definitions = getDefinitions(element);
  const messageId = `Message_${bo.id}`;
  const itemDefId = `_${messageId}_Item`;
  const messageName = `kafka_${bo.id}`;

  // Create itemDefinition for the message
  const itemDef = bpmnFactory.create('bpmn:ItemDefinition', {
    id: itemDefId,
    structureRef: 'java.lang.Object'
  });
  itemDef.$parent = definitions;

  // Create message
  const message = bpmnFactory.create('bpmn:Message', {
    id: messageId,
    name: messageName,
    itemRef: itemDef
  });
  message.$parent = definitions;

  // Add itemDefinition and message to definitions rootElements
  const rootElements = [...(definitions.rootElements || [])];
  const processIndex = rootElements.findIndex((el: any) => el.$type === 'bpmn:Process');
  if (processIndex >= 0) {
    rootElements.splice(processIndex, 0, itemDef, message);
  } else {
    rootElements.push(itemDef, message);
  }

  commandStack.execute('element.updateModdleProperties', {
    element,
    moddleElement: definitions,
    properties: { rootElements }
  });

  // Set messageRef on the receive task
  commandStack.execute('element.updateModdleProperties', {
    element,
    moddleElement: bo,
    properties: { messageRef: message }
  });
}

// Helper to get or create Kafka config
function getOrCreateKafkaConfig(element: any, moddle: any, modeling: any): any {
  let kafkaConfig = getKafkaConfig(element);

  if (!kafkaConfig) {
    const bo = element.businessObject;

    // Create Kafka config
    kafkaConfig = moddle.create('kafka:KafkaTaskConfig', {
      topic: '',
      bootstrapServers: 'localhost:9092',
      operation: 'publish',
      keyExpression: '',
      messageExpression: '',
      headers: '{}',
      acks: 'all',
      retries: 3,
      timeout: 30000,
      responseVariable: 'kafkaResponse'
    });

    // Get or create extension elements
    let extensionElements = bo.extensionElements;
    if (!extensionElements) {
      extensionElements = moddle.create('bpmn:ExtensionElements', { values: [] });
      modeling.updateProperties(element, { extensionElements });
    }

    // Add Kafka config to extension elements
    kafkaConfig.$parent = extensionElements;
    extensionElements.values = extensionElements.values || [];
    extensionElements.values.push(kafkaConfig);
  }

  return kafkaConfig;
}

// Kafka Properties Group
function KafkaPropertiesGroup(element: any, injector: any) {
  if (!isKafkaTask(element)) {
    return null;
  }

  const modeling = injector.get('modeling');
  const kafkaConfig = getKafkaConfig(element);

  if (!kafkaConfig) return null;

  const isProducer = kafkaConfig.operation === 'publish';

  const entries = [
    {
      id: 'kafka-topic',
      element,
      label: 'Topic',
      description: 'Kafka topic name',
      component: createTextInput('topic', kafkaConfig, modeling, element)
    },
    {
      id: 'kafka-bootstrap-servers',
      element,
      label: 'Bootstrap Servers',
      description: 'Kafka broker addresses (comma-separated)',
      component: createTextInput('bootstrapServers', kafkaConfig, modeling, element)
    },
    {
      id: 'kafka-operation',
      element,
      label: 'Operation',
      component: createSelectInput('operation', kafkaConfig, modeling, element, [
        { value: 'publish', label: 'Publish (Producer)' },
        { value: 'consume', label: 'Consume (Consumer)' }
      ])
    }
  ];

  // Producer-specific fields
  if (isProducer) {
    entries.push(
      {
        id: 'kafka-key-expression',
        element,
        label: 'Key Expression',
        description: 'Expression for message key (optional)',
        component: createTextInput('keyExpression', kafkaConfig, modeling, element)
      },
      {
        id: 'kafka-message-expression',
        element,
        label: 'Message Expression',
        description: 'Expression for message value',
        component: createTextAreaInput('messageExpression', kafkaConfig, modeling, element)
      },
      {
        id: 'kafka-headers',
        element,
        label: 'Headers (JSON)',
        description: 'Message headers as JSON',
        component: createTextAreaInput('headers', kafkaConfig, modeling, element)
      },
      {
        id: 'kafka-acks',
        element,
        label: 'Acknowledgment',
        component: createSelectInput('acks', kafkaConfig, modeling, element, [
          { value: 'all', label: 'All (strongest)' },
          { value: '1', label: 'Leader only' },
          { value: '0', label: 'None (fire & forget)' }
        ])
      },
      {
        id: 'kafka-retries',
        element,
        label: 'Retries',
        description: 'Number of retry attempts',
        component: createTextInput('retries', kafkaConfig, modeling, element)
      }
    );
  } else {
    // Consumer-specific fields
    entries.push(
      {
        id: 'kafka-group-id',
        element,
        label: 'Consumer Group ID',
        description: 'Consumer group identifier',
        component: createTextInput('groupId', kafkaConfig, modeling, element)
      },
      {
        id: 'kafka-auto-offset-reset',
        element,
        label: 'Auto Offset Reset',
        component: createSelectInput('autoOffsetReset', kafkaConfig, modeling, element, [
          { value: 'earliest', label: 'Earliest' },
          { value: 'latest', label: 'Latest' },
          { value: 'none', label: 'None' }
        ])
      }
    );
  }

  // Common fields
  entries.push(
    {
      id: 'kafka-timeout',
      element,
      label: 'Timeout (ms)',
      component: createTextInput('timeout', kafkaConfig, modeling, element)
    },
    {
      id: 'kafka-response-variable',
      element,
      label: 'Response Variable',
      description: 'Variable to store the result',
      component: createTextInput('responseVariable', kafkaConfig, modeling, element)
    }
  );

  return {
    id: 'kafka-configuration',
    label: 'Kafka Configuration',
    entries
  };
}

function createTextInput(property: string, config: any, modeling: any, element: any) {
  return function TextInput(props: any) {
    const html = (window as any).html;
    if (!html) {
      return null;
    }

    const value = config[property] || '';

    const onChange = (event: any) => {
      config[property] = event.target.value;
      modeling.updateProperties(element, {});
    };

    return html`
      <input
        type="text"
        class="bio-properties-panel-input"
        value=${value}
        onInput=${onChange}
      />
    `;
  };
}

function createSelectInput(property: string, config: any, modeling: any, element: any, options: Array<{value: string, label: string}>) {
  return function SelectInput(props: any) {
    const html = (window as any).html;
    if (!html) return null;

    const value = config[property] || options[0].value;

    const onChange = (event: any) => {
      config[property] = event.target.value;
      modeling.updateProperties(element, {});
    };

    return html`
      <select
        class="bio-properties-panel-input"
        value=${value}
        onChange=${onChange}
      >
        ${options.map(opt => html`<option value=${opt.value}>${opt.label}</option>`)}
      </select>
    `;
  };
}

function createTextAreaInput(property: string, config: any, modeling: any, element: any) {
  return function TextAreaInput(props: any) {
    const html = (window as any).html;
    if (!html) return null;

    const value = config[property] || '';

    const onChange = (event: any) => {
      config[property] = event.target.value;
      modeling.updateProperties(element, {});
    };

    return html`
      <textarea
        class="bio-properties-panel-input"
        rows="4"
        onInput=${onChange}
      >${value}</textarea>
    `;
  };
}

// Provider class
export default class KafkaTaskPropertiesProvider {
  static $inject = ['propertiesPanel', 'injector'];

  private injector: any;

  constructor(propertiesPanel: any, injector: any) {
    this.injector = injector;
    propertiesPanel.registerProvider(500, this);
  }

  getGroups(element: any) {
    return (groups: any[]) => {
      // For Kafka receive tasks, ensure they have a messageRef (required by jBPM)
      if (isKafkaReceiveTask(element)) {
        const bpmnFactory = this.injector.get('bpmnFactory');
        const commandStack = this.injector.get('commandStack');
        ensureMessageRef(element, bpmnFactory, commandStack);
      }

      const kafkaGroup = KafkaPropertiesGroup(element, this.injector);
      if (kafkaGroup) {
        groups.push(kafkaGroup);
      }
      return groups;
    };
  }
}
