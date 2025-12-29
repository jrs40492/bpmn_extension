/**
 * Kafka Task Configuration Panel
 * A custom panel for editing Kafka task properties
 */

interface KafkaConfig {
  topic: string;
  bootstrapServers: string;
  operation: string;
  keyExpression: string;
  messageExpression: string;
  groupId: string;
  headers: string;
  acks: string;
  retries: number;
  timeout: number;
  autoOffsetReset: string;
  responseVariable: string;
}

interface BusinessObject {
  $type: string;
  extensionElements?: {
    values?: Array<{
      $type: string;
      topic?: string;
      bootstrapServers?: string;
      operation?: string;
      keyExpression?: string;
      messageExpression?: string;
      groupId?: string;
      headers?: string;
      acks?: string;
      retries?: number;
      timeout?: number;
      autoOffsetReset?: string;
      responseVariable?: string;
      $parent?: unknown;
    }>;
    $parent?: unknown;
  };
}

interface Element {
  businessObject: BusinessObject;
}

interface Modeling {
  updateProperties: (element: Element, props: Record<string, unknown>) => void;
}

interface EventBus {
  on: (event: string, callback: (event: unknown) => void) => void;
}

// Get Kafka config from element
function getKafkaConfig(element: Element | null): KafkaConfig | null {
  if (!element?.businessObject) return null;

  const bo = element.businessObject;
  if (bo.$type !== 'bpmn:SendTask' && bo.$type !== 'bpmn:ReceiveTask' && bo.$type !== 'bpmn:ServiceTask') {
    return null;
  }

  const extensionElements = bo.extensionElements;
  if (!extensionElements?.values) return null;

  const kafkaConfig = extensionElements.values.find(
    (ext) => ext.$type === 'kafka:KafkaTaskConfig'
  );

  if (!kafkaConfig) return null;

  return {
    topic: kafkaConfig.topic || '',
    bootstrapServers: kafkaConfig.bootstrapServers || 'localhost:9092',
    operation: kafkaConfig.operation || 'publish',
    keyExpression: kafkaConfig.keyExpression || '',
    messageExpression: kafkaConfig.messageExpression || '',
    groupId: kafkaConfig.groupId || '',
    headers: kafkaConfig.headers || '{}',
    acks: kafkaConfig.acks || 'all',
    retries: kafkaConfig.retries || 3,
    timeout: kafkaConfig.timeout || 30000,
    autoOffsetReset: kafkaConfig.autoOffsetReset || 'earliest',
    responseVariable: kafkaConfig.responseVariable || 'kafkaResponse'
  };
}

// Update Kafka config on element
function updateKafkaConfig(element: Element, property: string, value: string | number, modeling: Modeling): void {
  const bo = element.businessObject;
  const extensionElements = bo.extensionElements;
  if (!extensionElements?.values) return;

  const kafkaConfig = extensionElements.values.find(
    (ext) => ext.$type === 'kafka:KafkaTaskConfig'
  );

  if (kafkaConfig) {
    (kafkaConfig as Record<string, unknown>)[property] = value;
    // Trigger update
    modeling.updateProperties(element, {});
  }
}

// Create the Kafka panel HTML
function createKafkaPanelHTML(): HTMLDivElement {
  const panel = document.createElement('div');
  panel.id = 'kafka-config-panel';
  panel.className = 'kafka-config-panel';
  panel.innerHTML = `
    <div class="kafka-panel-header">
      <span class="kafka-panel-icon">📨</span>
      <span class="kafka-panel-title">Kafka Configuration</span>
      <button class="kafka-panel-close" title="Close">&times;</button>
    </div>
    <div class="kafka-panel-body">
      <div class="kafka-field">
        <label for="kafka-topic">Topic</label>
        <input type="text" id="kafka-topic" placeholder="my-topic" />
      </div>
      <div class="kafka-field">
        <label for="kafka-bootstrap-servers">Bootstrap Servers</label>
        <input type="text" id="kafka-bootstrap-servers" placeholder="localhost:9092" />
      </div>
      <div class="kafka-field">
        <label for="kafka-operation">Operation</label>
        <select id="kafka-operation">
          <option value="publish">Publish (Producer)</option>
          <option value="consume">Consume (Consumer)</option>
        </select>
      </div>

      <!-- Producer fields -->
      <div class="kafka-producer-fields">
        <div class="kafka-field">
          <label for="kafka-key-expression">Key Expression</label>
          <input type="text" id="kafka-key-expression" placeholder="\${orderId}" />
        </div>
        <div class="kafka-field">
          <label for="kafka-message-expression">Message Expression</label>
          <textarea id="kafka-message-expression" rows="3" placeholder="\${orderData}"></textarea>
        </div>
        <div class="kafka-field">
          <label for="kafka-headers">Headers (JSON)</label>
          <textarea id="kafka-headers" rows="2" placeholder='{"correlation-id": "\${correlationId}"}'></textarea>
        </div>
        <div class="kafka-field">
          <label for="kafka-acks">Acknowledgment</label>
          <select id="kafka-acks">
            <option value="all">All (strongest durability)</option>
            <option value="1">Leader only</option>
            <option value="0">None (fire & forget)</option>
          </select>
        </div>
        <div class="kafka-field">
          <label for="kafka-retries">Retries</label>
          <input type="number" id="kafka-retries" placeholder="3" min="0" />
        </div>
      </div>

      <!-- Consumer fields -->
      <div class="kafka-consumer-fields" style="display: none;">
        <div class="kafka-field">
          <label for="kafka-group-id">Consumer Group ID</label>
          <input type="text" id="kafka-group-id" placeholder="my-consumer-group" />
        </div>
        <div class="kafka-field">
          <label for="kafka-auto-offset-reset">Auto Offset Reset</label>
          <select id="kafka-auto-offset-reset">
            <option value="earliest">Earliest</option>
            <option value="latest">Latest</option>
            <option value="none">None</option>
          </select>
        </div>
      </div>

      <!-- Common fields -->
      <div class="kafka-field">
        <label for="kafka-timeout">Timeout (ms)</label>
        <input type="number" id="kafka-timeout" placeholder="30000" min="0" />
      </div>
      <div class="kafka-field">
        <label for="kafka-response-variable">Response Variable</label>
        <input type="text" id="kafka-response-variable" placeholder="kafkaResponse" />
      </div>

      <div class="kafka-help">
        <p class="kafka-help-title">Expressions</p>
        <p>Use <code>\${variableName}</code> to reference process variables</p>
        <p>Use <code>\${execution.processInstanceId}</code> for process context</p>
      </div>
    </div>
  `;
  return panel;
}

// Initialize Kafka panel
export function initKafkaPanel(eventBus: EventBus, modeling: Modeling): void {
  let currentElement: Element | null = null;
  let panel: HTMLDivElement | null = null;

  // Create panel
  panel = createKafkaPanelHTML();
  document.body.appendChild(panel);

  // Get input elements
  const topicInput = panel.querySelector('#kafka-topic') as HTMLInputElement;
  const bootstrapServersInput = panel.querySelector('#kafka-bootstrap-servers') as HTMLInputElement;
  const operationSelect = panel.querySelector('#kafka-operation') as HTMLSelectElement;
  const keyExpressionInput = panel.querySelector('#kafka-key-expression') as HTMLInputElement;
  const messageExpressionInput = panel.querySelector('#kafka-message-expression') as HTMLTextAreaElement;
  const headersInput = panel.querySelector('#kafka-headers') as HTMLTextAreaElement;
  const acksSelect = panel.querySelector('#kafka-acks') as HTMLSelectElement;
  const retriesInput = panel.querySelector('#kafka-retries') as HTMLInputElement;
  const groupIdInput = panel.querySelector('#kafka-group-id') as HTMLInputElement;
  const autoOffsetResetSelect = panel.querySelector('#kafka-auto-offset-reset') as HTMLSelectElement;
  const timeoutInput = panel.querySelector('#kafka-timeout') as HTMLInputElement;
  const responseVariableInput = panel.querySelector('#kafka-response-variable') as HTMLInputElement;
  const closeButton = panel.querySelector('.kafka-panel-close') as HTMLButtonElement;

  const producerFields = panel.querySelector('.kafka-producer-fields') as HTMLDivElement;
  const consumerFields = panel.querySelector('.kafka-consumer-fields') as HTMLDivElement;

  // Toggle producer/consumer fields
  function toggleOperationFields(operation: string) {
    if (operation === 'publish') {
      producerFields.style.display = 'block';
      consumerFields.style.display = 'none';
    } else {
      producerFields.style.display = 'none';
      consumerFields.style.display = 'block';
    }
  }

  // Close button handler
  closeButton.addEventListener('click', () => {
    panel!.classList.remove('visible');
    currentElement = null;
  });

  // Input handlers
  topicInput.addEventListener('input', () => {
    if (currentElement) updateKafkaConfig(currentElement, 'topic', topicInput.value, modeling);
  });

  bootstrapServersInput.addEventListener('input', () => {
    if (currentElement) updateKafkaConfig(currentElement, 'bootstrapServers', bootstrapServersInput.value, modeling);
  });

  operationSelect.addEventListener('change', () => {
    if (currentElement) {
      updateKafkaConfig(currentElement, 'operation', operationSelect.value, modeling);
      toggleOperationFields(operationSelect.value);
    }
  });

  keyExpressionInput.addEventListener('input', () => {
    if (currentElement) updateKafkaConfig(currentElement, 'keyExpression', keyExpressionInput.value, modeling);
  });

  messageExpressionInput.addEventListener('input', () => {
    if (currentElement) updateKafkaConfig(currentElement, 'messageExpression', messageExpressionInput.value, modeling);
  });

  headersInput.addEventListener('input', () => {
    if (currentElement) updateKafkaConfig(currentElement, 'headers', headersInput.value, modeling);
  });

  acksSelect.addEventListener('change', () => {
    if (currentElement) updateKafkaConfig(currentElement, 'acks', acksSelect.value, modeling);
  });

  retriesInput.addEventListener('input', () => {
    if (currentElement) updateKafkaConfig(currentElement, 'retries', parseInt(retriesInput.value, 10) || 3, modeling);
  });

  groupIdInput.addEventListener('input', () => {
    if (currentElement) updateKafkaConfig(currentElement, 'groupId', groupIdInput.value, modeling);
  });

  autoOffsetResetSelect.addEventListener('change', () => {
    if (currentElement) updateKafkaConfig(currentElement, 'autoOffsetReset', autoOffsetResetSelect.value, modeling);
  });

  timeoutInput.addEventListener('input', () => {
    if (currentElement) updateKafkaConfig(currentElement, 'timeout', parseInt(timeoutInput.value, 10) || 30000, modeling);
  });

  responseVariableInput.addEventListener('input', () => {
    if (currentElement) updateKafkaConfig(currentElement, 'responseVariable', responseVariableInput.value, modeling);
  });

  // Listen for selection changes
  eventBus.on('selection.changed', (event: unknown) => {
    const selectionEvent = event as { newSelection?: Element[] };
    const selection = selectionEvent.newSelection;

    if (selection && selection.length === 1) {
      const element = selection[0];
      const config = getKafkaConfig(element);

      if (config) {
        currentElement = element;

        // Populate fields
        topicInput.value = config.topic;
        bootstrapServersInput.value = config.bootstrapServers;
        operationSelect.value = config.operation;
        keyExpressionInput.value = config.keyExpression;
        messageExpressionInput.value = config.messageExpression;
        headersInput.value = config.headers;
        acksSelect.value = config.acks;
        retriesInput.value = String(config.retries);
        groupIdInput.value = config.groupId;
        autoOffsetResetSelect.value = config.autoOffsetReset;
        timeoutInput.value = String(config.timeout);
        responseVariableInput.value = config.responseVariable;

        // Toggle fields based on operation
        toggleOperationFields(config.operation);

        // Show panel
        panel!.classList.add('visible');
      } else {
        panel!.classList.remove('visible');
        currentElement = null;
      }
    } else {
      panel!.classList.remove('visible');
      currentElement = null;
    }
  });
}
