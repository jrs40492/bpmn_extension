/**
 * Custom Resize Provider for Tasks
 * Extends the default resize rules to allow resizing Task elements
 *
 * This uses a RuleProvider to intercept the 'shape.resize' rule check
 * with a very high priority to override BpmnRules.
 */

import RuleProvider from 'diagram-js/lib/features/rules/RuleProvider';
import { is } from 'bpmn-js/lib/util/ModelUtil';

const MIN_WIDTH = 50;
const MIN_HEIGHT = 50;

// Must be higher than BpmnRules priority (which is 1500)
const PRIORITY = 2000;

interface Shape {
  type: string;
  businessObject?: {
    $type: string;
  };
  width: number;
  height: number;
}

interface Bounds {
  width: number;
  height: number;
  x: number;
  y: number;
}

/**
 * Check if an element is a task that should be resizable
 */
function isResizableTask(element: Shape): boolean {
  if (!element) return false;

  return is(element, 'bpmn:Task') ||
         is(element, 'bpmn:ServiceTask') ||
         is(element, 'bpmn:UserTask') ||
         is(element, 'bpmn:SendTask') ||
         is(element, 'bpmn:ReceiveTask') ||
         is(element, 'bpmn:ManualTask') ||
         is(element, 'bpmn:BusinessRuleTask') ||
         is(element, 'bpmn:ScriptTask') ||
         is(element, 'bpmn:CallActivity');
}

export default class TaskResizeProvider extends RuleProvider {
  static $inject = ['eventBus'];

  constructor(eventBus: any) {
    super(eventBus);
  }

  init(): void {
    /**
     * Allow resizing for task elements.
     * Returns true to allow resize, false to deny, undefined to defer to other rules.
     */
    this.addRule('shape.resize', PRIORITY, (context: { shape: Shape; newBounds?: Bounds }) => {
      const { shape, newBounds } = context;

      if (!isResizableTask(shape)) {
        // Let default rules handle non-task elements
        return;
      }

      // If newBounds provided, validate the resize operation
      if (newBounds) {
        if (newBounds.width < MIN_WIDTH || newBounds.height < MIN_HEIGHT) {
          return false;
        }
      }

      // Allow resize for tasks
      return true;
    });
  }
}
