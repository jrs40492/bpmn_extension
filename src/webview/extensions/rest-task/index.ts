/**
 * REST Task Extension Module
 * Uses STANDARD BPMN elements only - no custom extensions
 *
 * Creates Kogito-compatible REST work items using:
 * - bpmn:task with drools:taskName="Rest"
 * - Standard bpmn:ioSpecification
 * - Standard bpmn:dataInputAssociation / dataOutputAssociation
 *
 * Automatically adds boundary error events to REST tasks for error handling
 */

import RestTaskPaletteProvider from './palette-provider';
import RestTaskPropertiesProvider from './properties-provider';
import RestTaskRenderer from './renderer';
import { isRestTask, hasBoundaryErrorEvent, getBoundaryErrorEvent } from './palette-provider';

// Re-export the drools descriptor (still needed for drools:taskName attribute)
export { droolsDescriptor } from './drools-descriptor';

// Export helper functions
export { isRestTask, getRestConfig, updateRestParam, REST_PARAMS, hasBoundaryErrorEvent, getBoundaryErrorEvent } from './palette-provider';

/**
 * Connection handler that automatically adds boundary error events to REST tasks
 * When a REST task is connected to its next node, this handler:
 * 1. Creates a boundary error event attached to the REST task
 * 2. Connects the boundary event to the same target as the main flow
 */
class RestTaskConnectionHandler {
  static $inject = ['eventBus', 'modeling', 'bpmnFactory', 'elementFactory', 'canvas'];

  constructor(
    eventBus: any,
    modeling: any,
    bpmnFactory: any,
    elementFactory: any,
    canvas: any
  ) {
    // Listen for new connections being added
    eventBus.on('connection.added', (event: any) => {
      const connection = event.element;

      // Only handle sequence flows
      if (connection.type !== 'bpmn:SequenceFlow') return;

      const source = connection.source;
      const target = connection.target;

      // Only handle REST tasks that don't already have a boundary error event
      if (!isRestTask(source)) return;
      if (hasBoundaryErrorEvent(source)) return;

      // Use setTimeout to ensure the connection is fully established before modifying
      setTimeout(() => {
        try {
          this.addBoundaryErrorFlow(source, target, modeling, bpmnFactory, elementFactory, canvas);
        } catch (error) {
          console.error('[REST Task] Error adding boundary error event:', error);
        }
      }, 50);
    });

    // Also handle reconnection - update boundary event's target
    eventBus.on('connection.changed', (event: any) => {
      const connection = event.element;
      if (connection.type !== 'bpmn:SequenceFlow') return;

      const source = connection.source;
      const target = connection.target;

      if (!isRestTask(source)) return;

      // Find existing boundary event
      const boundaryEvent = getBoundaryErrorEvent(source);
      if (!boundaryEvent) return;

      // Find the boundary event's outgoing connection and update its target
      const boundaryOutgoing = boundaryEvent.outgoing?.[0];
      if (boundaryOutgoing && boundaryOutgoing.target !== target) {
        try {
          modeling.reconnectEnd(boundaryOutgoing, target, {
            x: target.x + target.width / 2,
            y: target.y
          });
        } catch (error) {
          console.error('[REST Task] Error updating boundary error flow:', error);
        }
      }
    });
  }

  /**
   * Add a boundary error event and connect it to the target
   */
  addBoundaryErrorFlow(
    restTask: any,
    target: any,
    modeling: any,
    bpmnFactory: any,
    elementFactory: any,
    canvas: any
  ): void {
    const taskBo = restTask.businessObject;
    const taskId = taskBo.id;

    // Create boundary event business object
    const boundaryEventBo = bpmnFactory.create('bpmn:BoundaryEvent', {
      id: `${taskId}_ErrorBoundary`,
      name: 'Error',
      attachedToRef: taskBo,
      cancelActivity: true
    });

    // Create error event definition (catch-all - no specific errorRef)
    const errorEventDef = bpmnFactory.create('bpmn:ErrorEventDefinition', {
      id: `${taskId}_ErrorEventDef`
    });
    boundaryEventBo.eventDefinitions = [errorEventDef];

    // Create the boundary event shape attached to the REST task
    // Position at bottom-center of the task
    const boundaryShape = elementFactory.createShape({
      type: 'bpmn:BoundaryEvent',
      businessObject: boundaryEventBo,
      host: restTask
    });

    // Add to canvas at the bottom of the REST task
    const position = {
      x: restTask.x + restTask.width / 2,
      y: restTask.y + restTask.height
    };

    modeling.createShape(boundaryShape, position, restTask, { attach: true });

    // Create sequence flow from boundary event to the target
    modeling.connect(boundaryShape, target);

    console.log(`[REST Task] Added boundary error event to ${taskId}, connected to ${target.id}`);
  }
}

// Export the module for bpmn-js additionalModules
export default {
  __init__: ['restTaskPaletteProvider', 'restTaskPropertiesProvider', 'restTaskRenderer', 'restTaskConnectionHandler'],
  restTaskPaletteProvider: ['type', RestTaskPaletteProvider],
  restTaskPropertiesProvider: ['type', RestTaskPropertiesProvider],
  restTaskRenderer: ['type', RestTaskRenderer],
  restTaskConnectionHandler: ['type', RestTaskConnectionHandler]
};
