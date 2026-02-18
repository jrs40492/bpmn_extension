/**
 * Error Boundary Properties Provider
 * Adds a ListGroup with "+" button to manage HTTP error codes on boundary error events.
 *
 * Stores codes as errbnd:ErrorCode children under errbnd:ErrorCodeList.
 * On export, the modeler expands this into multiple BPMN-compliant boundary events.
 */

// @ts-expect-error - no type definitions available
import { ListGroup, TextFieldEntry } from '@bpmn-io/properties-panel';
// @ts-expect-error - no type definitions available
import { useService } from 'bpmn-js-properties-panel';

// ============================================================================
// Type Definitions
// ============================================================================

interface ModdleElement {
  $type: string;
  $parent?: ModdleElement;
  id?: string;
  name?: string;
  errorCode?: string;
}

interface ErrorEventDefinition extends ModdleElement {
  errorRef?: ModdleElement;
}

interface ExtensionElements extends ModdleElement {
  values?: ModdleElement[];
}

interface ErrorCode extends ModdleElement {
  code?: string;
}

interface ErrorCodeList extends ModdleElement {
  codes?: ErrorCode[];
  groupId?: string;
  targetVariable?: string;
}

interface BusinessObject extends ModdleElement {
  eventDefinitions?: ModdleElement[];
  extensionElements?: ExtensionElements;
}

interface BpmnElement {
  businessObject?: BusinessObject;
}

interface BpmnFactory {
  create(type: string, properties?: Record<string, unknown>): ModdleElement;
}

interface CommandStack {
  execute(command: string, context: Record<string, unknown>): void;
}

interface PropertiesPanel {
  registerProvider(priority: number, provider: unknown): void;
}

interface PropertiesGroup {
  id: string;
  label?: string;
  component?: unknown;
  items?: unknown[];
  add?: (event: Event) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

function isBoundaryErrorEvent(element: BpmnElement): boolean {
  const bo = element?.businessObject;
  if (!bo) return false;
  if (bo.$type !== 'bpmn:BoundaryEvent') return false;

  const eventDefinitions = bo.eventDefinitions || [];
  return eventDefinitions.some((ed: ModdleElement) => ed.$type === 'bpmn:ErrorEventDefinition');
}

function getErrorEventDefinition(element: BpmnElement): ErrorEventDefinition | null {
  const bo = element?.businessObject;
  if (!bo) return null;

  const eventDefinitions = bo.eventDefinitions || [];
  return eventDefinitions.find((ed: ModdleElement) => ed.$type === 'bpmn:ErrorEventDefinition') as ErrorEventDefinition || null;
}

function getErrorCodeList(element: BpmnElement): ErrorCodeList | null {
  const bo = element?.businessObject;
  if (!bo) return null;

  const extensionElements = bo.extensionElements;
  if (!extensionElements) return null;

  const values = extensionElements.values || [];
  return values.find((ext: ModdleElement) => ext.$type === 'errbnd:ErrorCodeList') as ErrorCodeList || null;
}

function getErrorCodes(element: BpmnElement): ErrorCode[] {
  const list = getErrorCodeList(element);
  if (!list) return [];
  return list.codes || [];
}

function getDefinitions(element: BpmnElement): ModdleElement {
  let current: ModdleElement | undefined = element.businessObject;
  while (current?.$parent) {
    current = current.$parent;
  }
  return current as ModdleElement;
}

function ensureErrorCodeList(
  element: BpmnElement,
  bpmnFactory: BpmnFactory,
  commandStack: CommandStack
): ErrorCodeList {
  const existing = getErrorCodeList(element);
  if (existing) return existing;

  const bo = element.businessObject!;

  // Ensure extensionElements exists
  let extensionElements = bo.extensionElements;
  if (!extensionElements) {
    extensionElements = bpmnFactory.create('bpmn:ExtensionElements', { values: [] }) as ExtensionElements;
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: bo,
      properties: { extensionElements }
    });
  }

  const errorCodeList = bpmnFactory.create('errbnd:ErrorCodeList', {
    codes: [],
    groupId: bo.id || ''
  }) as ErrorCodeList;
  errorCodeList.$parent = extensionElements;

  commandStack.execute('element.updateModdleProperties', {
    element,
    moddleElement: extensionElements,
    properties: {
      values: [...(extensionElements.values || []), errorCodeList]
    }
  });

  return errorCodeList;
}

/**
 * Sync the first error code to the errorRef on the errorEventDefinition.
 * Reuses existing bpmn:Error from rootElements if one matches the code.
 */
function syncFirstCodeToErrorRef(element: BpmnElement, bpmnFactory: BpmnFactory, commandStack: CommandStack): void {
  const errEvtDef = getErrorEventDefinition(element);
  if (!errEvtDef) return;

  const codes = getErrorCodes(element);
  const firstCode = codes.length > 0 ? (codes[0].code || '') : '';

  if (!firstCode) {
    // No codes — clear errorRef
    if (errEvtDef.errorRef) {
      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: errEvtDef,
        properties: { errorRef: undefined }
      });
    }
    return;
  }

  // Already pointing at the right code?
  if (errEvtDef.errorRef?.errorCode === firstCode) return;

  const definitions = getDefinitions(element);
  const rootElements = (definitions as unknown as { rootElements?: ModdleElement[] }).rootElements || [];

  // Try to reuse an existing bpmn:Error with matching errorCode
  let errorEl = rootElements.find(
    (el: ModdleElement) => el.$type === 'bpmn:Error' && el.errorCode === firstCode
  );

  if (!errorEl) {
    const bo = element.businessObject!;
    const errorId = `Error_${firstCode}_${bo.id || 'evt'}`;
    errorEl = bpmnFactory.create('bpmn:Error', {
      id: errorId,
      name: `HTTP ${firstCode}`,
      errorCode: firstCode
    });
    errorEl.$parent = definitions;

    const newRootElements = [...rootElements];
    const processIndex = newRootElements.findIndex((el: ModdleElement) => el.$type === 'bpmn:Process');
    if (processIndex >= 0) {
      newRootElements.splice(processIndex, 0, errorEl);
    } else {
      newRootElements.push(errorEl);
    }

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: definitions,
      properties: { rootElements: newRootElements }
    });
  }

  commandStack.execute('element.updateModdleProperties', {
    element,
    moddleElement: errEvtDef,
    properties: { errorRef: errorEl }
  });
}

// ============================================================================
// Property Panel Components
// ============================================================================

function ErrorCodeEntryComponent(props: { id: string; errorCode: ErrorCode; element: BpmnElement }) {
  const { id, errorCode, element } = props;
  const commandStack = useService('commandStack') as CommandStack;
  const bpmnFactory = useService('bpmnFactory') as BpmnFactory;
  const translate = useService('translate') as (text: string) => string;
  const debounce = useService('debounceInput') as <T>(fn: T) => T;

  const getValue = () => errorCode.code || '';

  const setValue = (value: string) => {
    // Only accept numeric HTTP status codes
    const cleaned = value.trim();
    const code = /^\d{3}$/.test(cleaned) ? cleaned : '';

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: errorCode,
      properties: { code }
    });

    // Sync first code to errorRef so built-in ERROR group stays in sync
    syncFirstCodeToErrorRef(element, bpmnFactory, commandStack);
  };

  return TextFieldEntry({
    id,
    element,
    label: translate('HTTP Status Code'),
    description: translate('3-digit HTTP status code (e.g., 404)'),
    getValue,
    setValue,
    debounce
  });
}

function ErrorCodeEntry(props: { idPrefix: string; errorCode: ErrorCode; element: BpmnElement }) {
  const { idPrefix, errorCode, element } = props;

  return [
    {
      id: `${idPrefix}-code`,
      component: ErrorCodeEntryComponent,
      errorCode,
      idPrefix,
      element
    }
  ];
}

function TargetVariableEntry(props: { element: BpmnElement; id: string }) {
  const { element, id } = props;
  const commandStack = useService('commandStack') as CommandStack;
  const bpmnFactory = useService('bpmnFactory') as BpmnFactory;
  const translate = useService('translate') as (text: string) => string;
  const debounce = useService('debounceInput') as <T>(fn: T) => T;

  const getValue = () => {
    const list = getErrorCodeList(element);
    return list?.targetVariable || '';
  };

  const setValue = (value: string) => {
    const errorCodeList = ensureErrorCodeList(element, bpmnFactory, commandStack);
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: errorCodeList,
      properties: { targetVariable: value || undefined }
    });
  };

  return TextFieldEntry({
    id,
    element,
    label: translate('Target Variable'),
    description: translate('Process variable to set with the caught HTTP error code (e.g., httpStatus)'),
    getValue,
    setValue,
    debounce
  });
}

function createAddErrorCodeHandler(bpmnFactory: BpmnFactory, commandStack: CommandStack, element: BpmnElement) {
  return function(event: Event) {
    event.stopPropagation();

    const errorCodeList = ensureErrorCodeList(element, bpmnFactory, commandStack);

    const newCode = bpmnFactory.create('errbnd:ErrorCode', {
      code: ''
    }) as ErrorCode;
    newCode.$parent = errorCodeList;

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: errorCodeList,
      properties: {
        codes: [...(errorCodeList.codes || []), newCode]
      }
    });
  };
}

function createRemoveErrorCodeHandler(commandStack: CommandStack, bpmnFactory: BpmnFactory, element: BpmnElement, errorCode: ErrorCode) {
  return function(event: Event) {
    event.stopPropagation();

    const errorCodeList = getErrorCodeList(element);
    if (!errorCodeList) return;

    const newCodes = (errorCodeList.codes || []).filter((c: ErrorCode) => c !== errorCode);

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: errorCodeList,
      properties: { codes: newCodes }
    });

    // If no codes left, remove the ErrorCodeList extension element and clear errorRef
    if (newCodes.length === 0) {
      const bo = element.businessObject;
      const extensionElements = bo?.extensionElements;
      if (extensionElements) {
        const newValues = (extensionElements.values || []).filter(
          (ext: ModdleElement) => ext.$type !== 'errbnd:ErrorCodeList'
        );
        commandStack.execute('element.updateModdleProperties', {
          element,
          moddleElement: extensionElements,
          properties: { values: newValues }
        });
      }
      const errEvtDef = getErrorEventDefinition(element);
      if (errEvtDef) {
        commandStack.execute('element.updateModdleProperties', {
          element,
          moddleElement: errEvtDef,
          properties: { errorRef: undefined }
        });
      }
    } else {
      // Re-sync first code
      syncFirstCodeToErrorRef(element, bpmnFactory, commandStack);
    }
  };
}

// ============================================================================
// ListGroup Factory
// ============================================================================

function ErrorCodesListGroup(props: { element: BpmnElement; injector: unknown }) {
  const { element, injector } = props;

  if (!isBoundaryErrorEvent(element)) {
    return null;
  }

  const bpmnFactory = (injector as { get: (name: string) => BpmnFactory }).get('bpmnFactory');
  const commandStack = (injector as { get: (name: string) => CommandStack }).get('commandStack');
  const translate = (injector as { get: (name: string) => (text: string) => string }).get('translate');

  const codes = getErrorCodes(element);

  const items = codes.map((errorCode: ErrorCode, index: number) => {
    const id = `${element.businessObject?.id || 'element'}-errcode-${index}`;
    return {
      id,
      label: errorCode.code || translate('<empty>'),
      entries: ErrorCodeEntry({
        idPrefix: id,
        errorCode,
        element
      }),
      autoFocusEntry: `${id}-code`,
      remove: createRemoveErrorCodeHandler(commandStack, bpmnFactory, element, errorCode)
    };
  });

  return {
    items,
    add: createAddErrorCodeHandler(bpmnFactory, commandStack, element),
    label: translate('HTTP Error Codes')
  };
}

// ============================================================================
// Properties Provider Class
// ============================================================================

export default class ErrorBoundaryPropertiesProvider {
  static $inject = ['propertiesPanel', 'injector'];

  private injector: unknown;

  constructor(propertiesPanel: PropertiesPanel, injector: unknown) {
    this.injector = injector;
    propertiesPanel.registerProvider(500, this);
  }

  getGroups(element: BpmnElement) {
    return (groups: PropertiesGroup[]) => {
      if (!isBoundaryErrorEvent(element)) {
        return groups;
      }

      groups.push({
        id: 'error-boundary-configuration',
        label: 'Error Boundary',
        entries: [
          {
            id: 'target-variable',
            component: TargetVariableEntry
          }
        ]
      } as PropertiesGroup);

      const errorCodesGroup = ErrorCodesListGroup({ element, injector: this.injector });
      if (errorCodesGroup) {
        groups.push({
          id: 'error-boundary-codes',
          component: ListGroup,
          ...errorCodesGroup
        });
      }

      return groups;
    };
  }
}
