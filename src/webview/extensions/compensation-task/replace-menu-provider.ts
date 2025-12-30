/**
 * Compensation Task Replace Menu Provider
 *
 * This provider ensures that compensation activities have proper replacement
 * options available in the popup menu.
 */

// Helper to check if element is a compensation activity
function isCompensationActivity(element: any): boolean {
  const bo = element?.businessObject;
  return bo && bo.isForCompensation === true;
}

// Helper to check if element is a Task type (Activity)
function isTask(element: any): boolean {
  const type = element?.businessObject?.$type;
  return type && (
    type === 'bpmn:Task' ||
    type === 'bpmn:ServiceTask' ||
    type === 'bpmn:UserTask' ||
    type === 'bpmn:ScriptTask' ||
    type === 'bpmn:BusinessRuleTask' ||
    type === 'bpmn:SendTask' ||
    type === 'bpmn:ReceiveTask' ||
    type === 'bpmn:ManualTask'
  );
}

// Task replacement options (same as in bpmn-js ReplaceOptions.TASK)
const TASK_REPLACE_OPTIONS = [
  {
    label: 'Task',
    actionName: 'replace-with-task',
    className: 'bpmn-icon-task',
    target: { type: 'bpmn:Task' }
  },
  {
    label: 'User Task',
    actionName: 'replace-with-user-task',
    className: 'bpmn-icon-user',
    target: { type: 'bpmn:UserTask' }
  },
  {
    label: 'Service Task',
    actionName: 'replace-with-service-task',
    className: 'bpmn-icon-service',
    target: { type: 'bpmn:ServiceTask' }
  },
  {
    label: 'Script Task',
    actionName: 'replace-with-script-task',
    className: 'bpmn-icon-script',
    target: { type: 'bpmn:ScriptTask' }
  },
  {
    label: 'Business Rule Task',
    actionName: 'replace-with-business-rule-task',
    className: 'bpmn-icon-business-rule',
    target: { type: 'bpmn:BusinessRuleTask' }
  },
  {
    label: 'Send Task',
    actionName: 'replace-with-send-task',
    className: 'bpmn-icon-send',
    target: { type: 'bpmn:SendTask' }
  },
  {
    label: 'Receive Task',
    actionName: 'replace-with-receive-task',
    className: 'bpmn-icon-receive',
    target: { type: 'bpmn:ReceiveTask' }
  },
  {
    label: 'Manual Task',
    actionName: 'replace-with-manual-task',
    className: 'bpmn-icon-manual',
    target: { type: 'bpmn:ManualTask' }
  },
  {
    label: 'Call Activity',
    actionName: 'replace-with-call-activity',
    className: 'bpmn-icon-call-activity',
    target: { type: 'bpmn:CallActivity' }
  }
];

export default class CompensationTaskReplaceMenuProvider {
  static $inject = ['popupMenu', 'bpmnReplace', 'translate'];

  private _bpmnReplace: any;
  private _translate: any;

  constructor(popupMenu: any, bpmnReplace: any, translate: any) {
    this._bpmnReplace = bpmnReplace;
    this._translate = translate;

    // Register as a popup menu provider for bpmn-replace
    // Use lower priority than default so our entries are added to existing ones
    popupMenu.registerProvider('bpmn-replace', 500, this);
  }

  getPopupMenuEntries(target: any): Record<string, any> {
    const translate = this._translate;
    const bpmnReplace = this._bpmnReplace;

    // Only apply to compensation activities that are tasks
    if (!isCompensationActivity(target) || !isTask(target)) {
      return {};
    }

    const currentType = target.businessObject.$type;
    const entries: Record<string, any> = {};

    // Create entries for each replacement option
    for (const option of TASK_REPLACE_OPTIONS) {
      // Skip if same type
      if (option.target.type === currentType) {
        continue;
      }

      entries[option.actionName] = {
        label: translate(option.label),
        className: option.className,
        action: () => {
          // Replace the element while preserving isForCompensation
          bpmnReplace.replaceElement(target, {
            ...option.target,
            isForCompensation: true
          });
        }
      };
    }

    return entries;
  }

  getPopupMenuHeaderEntries(_target: any): Record<string, any> {
    // Compensation activities still get header entries from the default provider
    return {};
  }
}
