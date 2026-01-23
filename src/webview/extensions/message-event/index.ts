/**
 * Message Event Extension Module
 * Provides properties panel configuration for Message Events
 *
 * Features:
 * - Message name configuration
 * - Payload fields definition (name, type)
 * - Output mappings to process variables
 * - Auto-configuration for message throw events (required by Kogito/jBPM)
 */

import MessageEventPropertiesProvider from './properties-provider';
import messageEventDescriptor from './moddle-descriptor';

// Export the moddle descriptor separately (needed for modeler config)
export { messageEventDescriptor };

// ============================================================================
// Type Definitions
// ============================================================================

interface ModdleElement {
  $type: string;
  $parent?: ModdleElement;
  id?: string;
  name?: string;
}

interface MessageEventDefinition extends ModdleElement {
  messageRef?: ModdleElement;
}

interface BusinessObject extends ModdleElement {
  eventDefinitions?: ModdleElement[];
  dataInputs?: ModdleElement[];
  dataInputAssociations?: ModdleElement[];
  inputSet?: ModdleElement;
}

interface BpmnElement {
  businessObject?: BusinessObject;
}

interface ShapeEvent {
  element: BpmnElement;
}

interface EventBus {
  on(event: string, callback: (event: ShapeEvent) => void): void;
}

interface BpmnFactory {
  create(type: string, properties?: Record<string, unknown>): ModdleElement;
}

interface CommandStack {
  execute(command: string, context: Record<string, unknown>): void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if element is a message throw event (Intermediate Throw or End)
 */
function isMessageThrowEvent(element: BpmnElement): boolean {
  const bo = element?.businessObject;
  if (!bo) return false;

  const isThrowType = bo.$type === 'bpmn:IntermediateThrowEvent' || bo.$type === 'bpmn:EndEvent';
  if (!isThrowType) return false;

  const eventDefinitions = bo.eventDefinitions || [];
  return eventDefinitions.some((ed: ModdleElement) => ed.$type === 'bpmn:MessageEventDefinition');
}

/**
 * Get the message event definition
 */
function getMessageEventDefinition(element: BpmnElement): MessageEventDefinition | null {
  const bo = element?.businessObject;
  if (!bo) return null;

  const eventDefinitions = bo.eventDefinitions || [];
  return eventDefinitions.find((ed: ModdleElement) => ed.$type === 'bpmn:MessageEventDefinition') as MessageEventDefinition || null;
}

/**
 * Get the definitions element (root of BPMN document)
 */
function getDefinitions(element: BpmnElement): ModdleElement {
  let current: ModdleElement | undefined = element.businessObject;
  while (current?.$parent) {
    current = current.$parent;
  }
  return current as ModdleElement;
}

/**
 * Get the process element from an element
 */
function getProcess(element: BpmnElement): ModdleElement | null {
  let current: ModdleElement | undefined = element.businessObject;
  while (current && current.$type !== 'bpmn:Process') {
    current = current.$parent;
  }
  return current || null;
}

// ============================================================================
// Message Event Creation Handler
// ============================================================================

/**
 * Handles automatic configuration of message throw events when created.
 * Kogito/jBPM requires message throw events to have data input structures
 * to specify what data to send with the message. Without this, the code
 * generator throws a NullPointerException.
 */
class MessageEventCreationHandler {
  static $inject = ['eventBus', 'bpmnFactory', 'commandStack'];

  constructor(eventBus: EventBus, bpmnFactory: BpmnFactory, commandStack: CommandStack) {
    eventBus.on('shape.added', (event: ShapeEvent) => {
      const element = event.element;

      // Only handle message throw events (Intermediate Throw and End events)
      if (!isMessageThrowEvent(element)) {
        return;
      }

      const bo = element.businessObject;
      if (!bo) return;

      // Check if data inputs already exist (event already configured)
      if (bo.dataInputs && bo.dataInputs.length > 0) {
        return;
      }

      // Use setTimeout to ensure element is fully initialized
      setTimeout(() => {
        this.setupThrowEventDataStructures(element, bpmnFactory, commandStack);
      }, 0);
    });
  }

  /**
   * Set up required data input structures for a message throw event.
   *
   * BPMN Events use dataInputs, inputSet, and dataInputAssociations directly
   * (NOT ioSpecification which is only for Activities/Tasks).
   *
   * Creates: dataInput, inputSet, and a default dataInputAssociation
   */
  private setupThrowEventDataStructures(
    element: BpmnElement,
    bpmnFactory: BpmnFactory,
    commandStack: CommandStack
  ): void {
    const bo = element.businessObject;
    if (!bo || !bo.id) return;

    const definitions = getDefinitions(element);
    const eventId = bo.id;

    // Create itemDefinition for the data input
    const itemDefId = `_${eventId}_InputItem`;
    const itemDef = bpmnFactory.create('bpmn:ItemDefinition', {
      id: itemDefId,
      structureRef: 'java.lang.String'
    });
    itemDef.$parent = definitions;

    // Add itemDefinition to definitions rootElements
    const rootElements = (definitions as unknown as { rootElements?: ModdleElement[] }).rootElements || [];
    const newRootElements = [...rootElements];
    const processIndex = newRootElements.findIndex((el: ModdleElement) => el.$type === 'bpmn:Process');
    if (processIndex >= 0) {
      newRootElements.splice(processIndex, 0, itemDef);
    } else {
      newRootElements.push(itemDef);
    }

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: definitions,
      properties: { rootElements: newRootElements }
    });

    // Create data input - for events this goes directly on the event, not in ioSpecification
    const dataInputId = `${eventId}_InputX`;
    const dataInput = bpmnFactory.create('bpmn:DataInput', {
      id: dataInputId,
      name: 'event',
      itemSubjectRef: itemDef
    });
    // Set drools:dtype attribute for Kogito compatibility (required for code generation)
    (dataInput as unknown as { set?: (key: string, value: string) => void }).set?.('drools:dtype', 'java.lang.String');
    dataInput.$parent = bo;

    // Create input set referencing the data input - also directly on event
    const inputSet = bpmnFactory.create('bpmn:InputSet', {
      dataInputRefs: [dataInput]
    });
    inputSet.$parent = bo;

    // Create a default data input association
    // This maps an empty string to prevent null pointer errors
    // Users should update this to map a real process variable
    const assignment = bpmnFactory.create('bpmn:Assignment', {});
    const fromExpr = bpmnFactory.create('bpmn:FormalExpression', {
      body: '""'  // Empty string as default to prevent null
    });
    const toExpr = bpmnFactory.create('bpmn:FormalExpression', {
      body: dataInputId
    });
    (assignment as unknown as { from: ModdleElement }).from = fromExpr;
    (assignment as unknown as { to: ModdleElement }).to = toExpr;
    fromExpr.$parent = assignment;
    toExpr.$parent = assignment;

    const dataInputAssociation = bpmnFactory.create('bpmn:DataInputAssociation', {
      targetRef: dataInput,
      assignment: [assignment]
    });
    assignment.$parent = dataInputAssociation;
    dataInputAssociation.$parent = bo;

    // Update the business object with the new structures
    // For events: dataInputs, inputSet, dataInputAssociations go directly on the event
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: bo,
      properties: {
        dataInputs: [dataInput],
        inputSet: inputSet,
        dataInputAssociations: [dataInputAssociation]
      }
    });

    // Ensure message exists for this throw event
    const msgEvtDef = getMessageEventDefinition(element);
    if (msgEvtDef && !msgEvtDef.messageRef) {
      // Create a message for the throw event
      const messageId = `Message_${eventId}`;
      const msgItemDefId = `_${messageId}_Item`;

      // Create item definition for message
      const msgItemDef = bpmnFactory.create('bpmn:ItemDefinition', {
        id: msgItemDefId,
        structureRef: 'java.lang.Object'
      });
      msgItemDef.$parent = definitions;

      // Create message
      const message = bpmnFactory.create('bpmn:Message', {
        id: messageId,
        name: `message_${eventId}`,
        itemRef: msgItemDef
      });
      message.$parent = definitions;

      // Add to root elements
      const currentRootElements = (definitions as unknown as { rootElements?: ModdleElement[] }).rootElements || [];
      const updatedRootElements = [...currentRootElements];
      const procIndex = updatedRootElements.findIndex((el: ModdleElement) => el.$type === 'bpmn:Process');
      if (procIndex >= 0) {
        updatedRootElements.splice(procIndex, 0, msgItemDef, message);
      } else {
        updatedRootElements.push(msgItemDef, message);
      }

      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: definitions,
        properties: { rootElements: updatedRootElements }
      });

      // Set message reference on the event definition
      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: msgEvtDef,
        properties: { messageRef: message }
      });
    }
  }
}

// Export the module for bpmn-js additionalModules
export default {
  __init__: ['messageEventPropertiesProvider', 'messageEventCreationHandler'],
  messageEventPropertiesProvider: ['type', MessageEventPropertiesProvider],
  messageEventCreationHandler: ['type', MessageEventCreationHandler]
};
