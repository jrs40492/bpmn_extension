/**
 * Sequence Flow Condition Extension
 *
 * Adds condition expression support for sequence flows in the properties panel.
 * This allows users to define routing conditions on outgoing flows from gateways.
 *
 * Uses standard BPMN conditionExpression element which is engine-agnostic.
 */

import { is } from 'bpmn-js/lib/util/ModelUtil';
// @ts-expect-error - no type definitions available
import { TextAreaEntry, SelectEntry } from '@bpmn-io/properties-panel';
// @ts-expect-error - no type definitions available
import { useService } from 'bpmn-js-properties-panel';

// Get the condition expression from a sequence flow
function getConditionExpression(element: any): any {
  const businessObject = element.businessObject || element;
  return businessObject.conditionExpression;
}

// Check if element is a conditional sequence flow (from gateway or has condition)
function isConditionalFlow(element: any): boolean {
  if (!is(element, 'bpmn:SequenceFlow')) {
    return false;
  }

  const businessObject = element.businessObject || element;
  const source = businessObject.sourceRef;

  // Flows from exclusive, inclusive, or complex gateways can have conditions
  if (source && (
    is(source, 'bpmn:ExclusiveGateway') ||
    is(source, 'bpmn:InclusiveGateway') ||
    is(source, 'bpmn:ComplexGateway')
  )) {
    return true;
  }

  // Also allow conditions on flows from activities (conditional flows)
  if (source && is(source, 'bpmn:Activity')) {
    return true;
  }

  return false;
}

// Check if this is the default flow from a gateway
function isDefaultFlow(element: any): boolean {
  const businessObject = element.businessObject || element;
  const source = businessObject.sourceRef;

  if (!source) return false;

  return source.default === businessObject;
}

// Get current condition type
function getConditionType(element: any): string {
  if (isDefaultFlow(element)) {
    return 'default';
  }
  if (getConditionExpression(element)) {
    return 'expression';
  }
  return 'none';
}

// Condition Type Select component
function ConditionTypeSelect(props: { element: any; id: string }) {
  const { element, id } = props;
  const commandStack = useService('commandStack');
  const translate = useService('translate');
  const bpmnFactory = useService('bpmnFactory');

  const businessObject = element.businessObject || element;

  const getValue = () => {
    return getConditionType(element);
  };

  const setValue = (value: string) => {
    const source = businessObject.sourceRef;

    if (value === 'default') {
      // Set as default flow on the source gateway
      if (source) {
        commandStack.execute('element.updateModdleProperties', {
          element: { id: source.id },
          moddleElement: source,
          properties: { default: businessObject }
        });
      }
      // Remove condition expression
      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: businessObject,
        properties: { conditionExpression: undefined }
      });
    } else if (value === 'expression') {
      // Remove default status if set
      if (source && source.default === businessObject) {
        commandStack.execute('element.updateModdleProperties', {
          element: { id: source.id },
          moddleElement: source,
          properties: { default: undefined }
        });
      }
      // Create condition expression if not exists
      if (!getConditionExpression(element)) {
        const newCondition = bpmnFactory.create('bpmn:FormalExpression', {
          body: ''
        });
        commandStack.execute('element.updateModdleProperties', {
          element,
          moddleElement: businessObject,
          properties: { conditionExpression: newCondition }
        });
      }
    } else {
      // None - remove both
      if (source && source.default === businessObject) {
        commandStack.execute('element.updateModdleProperties', {
          element: { id: source.id },
          moddleElement: source,
          properties: { default: undefined }
        });
      }
      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: businessObject,
        properties: { conditionExpression: undefined }
      });
    }
  };

  const getOptions = () => [
    { value: 'none', label: translate('None') },
    { value: 'expression', label: translate('Expression') },
    { value: 'default', label: translate('Default Flow') }
  ];

  return SelectEntry({
    id,
    element,
    label: translate('Condition Type'),
    getValue,
    setValue,
    getOptions
  });
}

// Expression Body TextArea component
function ExpressionBody(props: { element: any; id: string }) {
  const { element, id } = props;
  const commandStack = useService('commandStack');
  const translate = useService('translate');
  const debounce = useService('debounceInput');

  const conditionExpression = getConditionExpression(element);

  const getValue = () => {
    return conditionExpression?.body || '';
  };

  const setValue = (value: string) => {
    if (conditionExpression) {
      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: conditionExpression,
        properties: { body: value }
      });
    }
  };

  // Only show if there's a condition expression
  if (!conditionExpression) {
    return null;
  }

  return TextAreaEntry({
    id,
    element,
    label: translate('Expression'),
    description: translate('Examples: ${amount > 1000}, ${status == "approved"}'),
    getValue,
    setValue,
    debounce,
    monospace: true,
    rows: 4
  });
}

// Expression Language Select component
function ExpressionLanguage(props: { element: any; id: string }) {
  const { element, id } = props;
  const commandStack = useService('commandStack');
  const translate = useService('translate');

  const conditionExpression = getConditionExpression(element);

  const getValue = () => {
    return conditionExpression?.language || '';
  };

  const setValue = (value: string) => {
    if (conditionExpression) {
      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: conditionExpression,
        properties: { language: value || undefined }
      });
    }
  };

  // jBPM-compatible language URIs
  const getOptions = () => [
    { value: '', label: translate('Default (MVEL)') },
    { value: 'http://www.mvel.org/2.0', label: 'MVEL' },
    { value: 'http://www.java.com/java', label: 'Java' },
    { value: 'http://www.w3.org/1999/XPath', label: 'XPath' },
    { value: 'feel', label: 'FEEL' }
  ];

  // Only show if there's a condition expression
  if (!conditionExpression) {
    return null;
  }

  return SelectEntry({
    id,
    element,
    label: translate('Expression Language'),
    getValue,
    setValue,
    getOptions
  });
}

// Create entries for condition
function ConditionEntries(props: { element: any }) {
  const { element } = props;

  if (!isConditionalFlow(element)) {
    return [];
  }

  return [
    {
      id: 'conditionType',
      component: ConditionTypeSelect,
      isEdited: () => getConditionType(element) !== 'none'
    },
    {
      id: 'conditionExpression',
      component: ExpressionBody,
      isEdited: () => !!getConditionExpression(element)?.body
    },
    {
      id: 'conditionLanguage',
      component: ExpressionLanguage,
      isEdited: () => !!getConditionExpression(element)?.language
    }
  ];
}

/**
 * Sequence Flow Condition Properties Provider
 */
class SequenceFlowConditionPropertiesProvider {
  static $inject = ['propertiesPanel'];

  constructor(propertiesPanel: any) {
    propertiesPanel.registerProvider(500, this);
  }

  getGroups(element: any) {
    return (groups: any[]) => {
      if (!isConditionalFlow(element)) {
        return groups;
      }

      // Find the general group and insert condition group after it
      const generalIndex = groups.findIndex((g: any) => g.id === 'general');
      const conditionGroup = {
        id: 'condition',
        label: 'Condition',
        entries: ConditionEntries({ element })
      };

      if (generalIndex !== -1) {
        groups.splice(generalIndex + 1, 0, conditionGroup);
      } else {
        groups.push(conditionGroup);
      }

      return groups;
    };
  }
}

// Module definition
export default {
  __init__: ['sequenceFlowConditionPropertiesProvider'],
  sequenceFlowConditionPropertiesProvider: ['type', SequenceFlowConditionPropertiesProvider]
};
