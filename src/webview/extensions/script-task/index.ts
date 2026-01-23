/**
 * Script Task Extension Module
 * Adds properties panel support for Script Task configuration
 */

import ScriptTaskPropertiesProvider from './properties-provider';

// ============================================================================
// Type Definitions
// ============================================================================

interface ModdleElement {
  $type: string;
  scriptFormat?: string;
  script?: string;
}

interface BpmnElement {
  businessObject?: ModdleElement;
}

interface ShapeEvent {
  element: BpmnElement;
}

interface EventBus {
  on(event: string, callback: (event: ShapeEvent) => void): void;
}

interface Modeling {
  updateProperties(element: BpmnElement, properties: Record<string, unknown>): void;
}

// ============================================================================
// Script Task Creation Handler
// ============================================================================

/**
 * Sets default properties when a Script Task is created from the palette.
 * This ensures scriptFormat and script are always set, preventing Kogito/jBPM
 * runtime errors when processing null script values.
 */
class ScriptTaskCreationHandler {
  static $inject = ['eventBus', 'modeling'];

  constructor(eventBus: EventBus, modeling: Modeling) {
    eventBus.on('shape.added', (event: ShapeEvent) => {
      const element = event.element;

      // Only handle Script Tasks
      if (element?.businessObject?.$type !== 'bpmn:ScriptTask') {
        return;
      }

      const bo = element.businessObject;
      const updates: Record<string, unknown> = {};

      // Set default script format if not already set
      if (!bo.scriptFormat) {
        updates.scriptFormat = 'java';
      }

      // Set empty script to avoid null pointer errors
      if (bo.script === undefined || bo.script === null) {
        updates.script = '';
      }

      // Apply updates if needed (use setTimeout to ensure element is fully initialized)
      if (Object.keys(updates).length > 0) {
        setTimeout(() => {
          modeling.updateProperties(element, updates);
        }, 0);
      }
    });
  }
}

// Export the module for bpmn-js additionalModules
export default {
  __init__: ['scriptTaskPropertiesProvider', 'scriptTaskCreationHandler'],
  scriptTaskPropertiesProvider: ['type', ScriptTaskPropertiesProvider],
  scriptTaskCreationHandler: ['type', ScriptTaskCreationHandler]
};
