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
  dataOutputs?: ModdleElement[];
  dataOutputAssociations?: ModdleElement[];
  outputSet?: ModdleElement;
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
 * Check if element is a message catch event (Intermediate Catch or Boundary)
 */
function isMessageCatchEvent(element: BpmnElement): boolean {
  const bo = element?.businessObject;
  if (!bo) return false;

  const isCatchType = bo.$type === 'bpmn:IntermediateCatchEvent' || bo.$type === 'bpmn:BoundaryEvent';
  if (!isCatchType) return false;

  const eventDefinitions = bo.eventDefinitions || [];
  return eventDefinitions.some((ed: ModdleElement) => ed.$type === 'bpmn:MessageEventDefinition');
}

/**
 * Check if element is a message start event
 */
function isMessageStartEvent(element: BpmnElement): boolean {
  const bo = element?.businessObject;
  if (!bo) return false;

  if (bo.$type !== 'bpmn:StartEvent') return false;

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
      const bo = element?.businessObject;
      if (!bo) return;

      // Handle message throw events (Intermediate Throw and End events)
      if (isMessageThrowEvent(element)) {
        // Check if data inputs already exist (event already configured)
        if (bo.dataInputs && bo.dataInputs.length > 0) {
          return;
        }

        // Use setTimeout to ensure element is fully initialized
        setTimeout(() => {
          this.setupThrowEventDataStructures(element, bpmnFactory, commandStack);
        }, 0);
      }

      // Handle message catch events (Intermediate Catch and Boundary events)
      if (isMessageCatchEvent(element)) {
        // Check if data outputs already exist (event already configured)
        if (bo.dataOutputs && bo.dataOutputs.length > 0) {
          return;
        }

        // Use setTimeout to ensure element is fully initialized
        setTimeout(() => {
          this.setupCatchEventDataStructures(element, bpmnFactory, commandStack);
        }, 0);
      }

      // Handle message start events (they also receive messages and need data outputs)
      if (isMessageStartEvent(element)) {
        // Check if data outputs already exist (event already configured)
        if (bo.dataOutputs && bo.dataOutputs.length > 0) {
          return;
        }

        // Use setTimeout to ensure element is fully initialized
        setTimeout(() => {
          this.setupCatchEventDataStructures(element, bpmnFactory, commandStack);
        }, 0);
      }
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

  /**
   * Set up required data output structures for a message catch event.
   *
   * BPMN Events use dataOutputs, outputSet, and dataOutputAssociations directly
   * (NOT ioSpecification which is only for Activities/Tasks).
   *
   * Kogito/jBPM requires these structures to know where to store the received
   * message data. Without this, the code generator throws a NullPointerException.
   */
  private setupCatchEventDataStructures(
    element: BpmnElement,
    bpmnFactory: BpmnFactory,
    commandStack: CommandStack
  ): void {
    const bo = element.businessObject;
    if (!bo || !bo.id) return;

    const definitions = getDefinitions(element);
    const eventId = bo.id;

    // Create itemDefinition for the data output
    // Use java.lang.Object to match the message itemDefinition type (messages can carry any data)
    const itemDefId = `_${eventId}_OutputItem`;
    const itemDef = bpmnFactory.create('bpmn:ItemDefinition', {
      id: itemDefId,
      structureRef: 'java.lang.Object'
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

    // Create data output - for events this goes directly on the event, not in ioSpecification
    const dataOutputId = `${eventId}_OutputX`;
    const dataOutput = bpmnFactory.create('bpmn:DataOutput', {
      id: dataOutputId,
      name: 'event',
      itemSubjectRef: itemDef
    });
    // Set drools:dtype attribute for Kogito compatibility (must match message type)
    (dataOutput as unknown as { set?: (key: string, value: string) => void }).set?.('drools:dtype', 'java.lang.Object');
    dataOutput.$parent = bo;

    // Create output set referencing the data output - also directly on event
    const outputSet = bpmnFactory.create('bpmn:OutputSet', {
      dataOutputRefs: [dataOutput]
    });
    outputSet.$parent = bo;

    // Create a default process variable to store the received message data
    // This is required by Kogito - the dataOutputAssociation must reference a valid variable
    const process = getProcess(element);
    const messageVarName = `message_${eventId}`;
    const messageVarId = messageVarName;

    if (process) {
      // Create itemDefinition for the process variable (must match message type)
      const varItemDefId = `_${messageVarId}Item`;
      const varItemDef = bpmnFactory.create('bpmn:ItemDefinition', {
        id: varItemDefId,
        structureRef: 'java.lang.Object'
      });
      varItemDef.$parent = definitions;

      // Add itemDefinition to rootElements
      const currentRootElements = (definitions as unknown as { rootElements?: ModdleElement[] }).rootElements || [];
      const updatedRootElements = [...currentRootElements];
      const procIdx = updatedRootElements.findIndex((el: ModdleElement) => el.$type === 'bpmn:Process');
      if (procIdx >= 0) {
        updatedRootElements.splice(procIdx, 0, varItemDef);
      } else {
        updatedRootElements.push(varItemDef);
      }

      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: definitions,
        properties: { rootElements: updatedRootElements }
      });

      // Create bpmn:property (process variable) for the received message
      const processProperty = bpmnFactory.create('bpmn:Property', {
        id: messageVarId,
        name: messageVarName,
        itemSubjectRef: varItemDef
      });
      processProperty.$parent = process;

      // Add property to process
      const existingProperties = (process as unknown as { properties?: ModdleElement[] }).properties || [];
      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: process,
        properties: { properties: [...existingProperties, processProperty] }
      });

      // Create data output association with targetRef pointing to the new variable
      const dataOutputAssociation = bpmnFactory.create('bpmn:DataOutputAssociation', {
        sourceRef: [dataOutput],
        targetRef: processProperty
      });
      dataOutputAssociation.$parent = bo;

      // Update the business object with the new structures
      // For events: dataOutputs, outputSet, dataOutputAssociations go directly on the event
      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: bo,
        properties: {
          dataOutputs: [dataOutput],
          outputSet: outputSet,
          dataOutputAssociations: [dataOutputAssociation]
        }
      });
    }

    // Ensure message exists for this catch event
    const msgEvtDef = getMessageEventDefinition(element);
    if (msgEvtDef && !msgEvtDef.messageRef) {
      // Create a message for the catch event
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

// ============================================================================
// Message Event Deletion Handler
// ============================================================================

/**
 * Check if element is any type of message event
 */
function isAnyMessageEvent(element: BpmnElement): boolean {
  const bo = element?.businessObject;
  if (!bo) return false;

  const eventTypes = [
    'bpmn:StartEvent',
    'bpmn:IntermediateThrowEvent',
    'bpmn:IntermediateCatchEvent',
    'bpmn:EndEvent',
    'bpmn:BoundaryEvent'
  ];

  if (!eventTypes.includes(bo.$type)) return false;

  const eventDefinitions = bo.eventDefinitions || [];
  return eventDefinitions.some((ed: ModdleElement) => ed.$type === 'bpmn:MessageEventDefinition');
}

/**
 * Check if a message is referenced by any element in the process
 */
function isMessageReferenced(definitions: ModdleElement, messageId: string): boolean {
  const rootElements = (definitions as unknown as { rootElements?: ModdleElement[] }).rootElements || [];

  // Find the process
  const process = rootElements.find((el: ModdleElement) => el.$type === 'bpmn:Process');
  if (!process) return false;

  // Get all flow elements in the process
  const flowElements = (process as unknown as { flowElements?: ModdleElement[] }).flowElements || [];

  // Check each flow element for message references
  for (const flowElement of flowElements) {
    const eventDefinitions = (flowElement as unknown as { eventDefinitions?: ModdleElement[] }).eventDefinitions || [];
    for (const ed of eventDefinitions) {
      if (ed.$type === 'bpmn:MessageEventDefinition') {
        const messageRef = (ed as unknown as { messageRef?: ModdleElement }).messageRef;
        if (messageRef?.id === messageId) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Handles cleanup of orphaned messages and itemDefinitions when message events are deleted.
 * This prevents Kogito code generation errors from orphaned message definitions.
 */
class MessageEventDeletionHandler {
  static $inject = ['eventBus', 'commandStack'];

  constructor(eventBus: EventBus, commandStack: CommandStack) {
    // Listen for shape removal
    eventBus.on('shape.remove', (event: ShapeEvent) => {
      const element = event.element;

      // Only handle message events
      if (!isAnyMessageEvent(element)) {
        return;
      }

      const bo = element.businessObject;
      if (!bo) return;

      // Get the message reference before the element is removed
      const msgEvtDef = getMessageEventDefinition(element);
      const messageRef = msgEvtDef?.messageRef;

      if (!messageRef) return;

      const definitions = getDefinitions(element);
      const messageId = messageRef.id;
      const eventId = bo.id;

      // Use setTimeout to allow the deletion to complete first
      setTimeout(() => {
        // Check if this message is still referenced by any other element
        if (isMessageReferenced(definitions, messageId || '')) {
          return; // Message is still in use, don't delete
        }

        // Collect orphaned elements to remove
        const rootElements = (definitions as unknown as { rootElements?: ModdleElement[] }).rootElements || [];
        const elementsToRemove: string[] = [];

        // Find the message
        const message = rootElements.find((el: ModdleElement) =>
          el.$type === 'bpmn:Message' && el.id === messageId
        );
        if (message) {
          elementsToRemove.push(messageId || '');

          // Find the message's itemDefinition
          const messageItemRef = (message as unknown as { itemRef?: ModdleElement }).itemRef;
          if (messageItemRef?.id) {
            elementsToRemove.push(messageItemRef.id);
          }
        }

        // Find the event's data input itemDefinition
        const eventItemDefId = `_${eventId}_InputItem`;
        if (rootElements.some((el: ModdleElement) =>
          el.$type === 'bpmn:ItemDefinition' && el.id === eventItemDefId
        )) {
          elementsToRemove.push(eventItemDefId);
        }

        // Remove orphaned elements
        if (elementsToRemove.length > 0) {
          const newRootElements = rootElements.filter((el: ModdleElement) =>
            !elementsToRemove.includes(el.id || '')
          );

          // Create a dummy element for the command (the original element is deleted)
          // We need to use a different approach since the element is being removed
          // We'll update definitions directly
          commandStack.execute('element.updateModdleProperties', {
            element: { businessObject: definitions },
            moddleElement: definitions,
            properties: { rootElements: newRootElements }
          });
        }
      }, 100);
    });
  }
}

// Export the module for bpmn-js additionalModules
export default {
  __init__: ['messageEventPropertiesProvider', 'messageEventCreationHandler', 'messageEventDeletionHandler'],
  messageEventPropertiesProvider: ['type', MessageEventPropertiesProvider],
  messageEventCreationHandler: ['type', MessageEventCreationHandler],
  messageEventDeletionHandler: ['type', MessageEventDeletionHandler]
};
