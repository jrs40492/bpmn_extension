/**
 * Compensation Task Context Pad Provider
 *
 * This provider ensures that Tasks with isForCompensation=true have access
 * to the replace menu (change element type) in the context pad.
 *
 * The default bpmn-js ContextPadProvider includes the replace menu for Tasks,
 * but this extension ensures it works correctly for compensation activities
 * which have special behavior.
 */

// Helper to check if element is a compensation activity
function isCompensationActivity(element: any): boolean {
  const bo = element?.businessObject;
  return bo && bo.isForCompensation === true;
}

// Helper to check if element is a Task type (Activity)
function isActivity(element: any): boolean {
  const type = element?.businessObject?.$type;
  return type && (
    type === 'bpmn:Task' ||
    type === 'bpmn:ServiceTask' ||
    type === 'bpmn:UserTask' ||
    type === 'bpmn:ScriptTask' ||
    type === 'bpmn:BusinessRuleTask' ||
    type === 'bpmn:SendTask' ||
    type === 'bpmn:ReceiveTask' ||
    type === 'bpmn:ManualTask' ||
    type === 'bpmn:SubProcess' ||
    type === 'bpmn:CallActivity'
  );
}

export default class CompensationTaskContextPad {
  static $inject = ['contextPad', 'popupMenu', 'translate', 'modeling'];

  private _popupMenu: any;
  private _translate: any;
  private _modeling: any;

  constructor(contextPad: any, popupMenu: any, translate: any, modeling: any) {
    this._popupMenu = popupMenu;
    this._translate = translate;
    this._modeling = modeling;

    // Register as a context pad provider with lower priority than default (1000)
    // This allows us to add or modify entries
    contextPad.registerProvider(400, this);
  }

  getContextPadEntries(element: any): Record<string, any> {
    const popupMenu = this._popupMenu;
    const translate = this._translate;
    const modeling = this._modeling;

    // Only apply to compensation activities that are activities
    if (!isCompensationActivity(element) || !isActivity(element)) {
      return {};
    }

    const actions: Record<string, any> = {};

    // Add the replace menu entry for compensation activities
    // The default provider should include this, but we ensure it's present
    if (!popupMenu.isEmpty(element, 'bpmn-replace')) {
      actions['replace'] = {
        group: 'edit',
        className: 'bpmn-icon-screw-wrench',
        title: translate('Change element'),
        action: {
          click: (event: MouseEvent, el: any) => {
            // Position the popup menu near the click
            const position = {
              x: event.clientX,
              y: event.clientY,
              cursor: { x: event.clientX, y: event.clientY }
            };

            popupMenu.open(el, 'bpmn-replace', position, {
              title: translate('Change element'),
              width: 300,
              search: true
            });
          }
        }
      };
    }

    // Ensure delete action is available for compensation activities
    actions['delete'] = {
      group: 'edit',
      className: 'bpmn-icon-trash',
      title: translate('Remove'),
      action: {
        click: (_event: MouseEvent, el: any) => {
          modeling.removeElements([el]);
        }
      }
    };

    return actions;
  }
}
