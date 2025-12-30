/**
 * Decision Output Properties Provider
 * Adds data type (typeRef) configuration to Decision Output elements in DMN Decision Table view
 */

import { SelectEntry, Group } from '@bpmn-io/properties-panel';

// DMN 1.3/1.6 FEEL built-in data types
const DMN_DATA_TYPES = [
  { value: '', label: 'Any (unspecified)' },
  { value: 'string', label: 'string' },
  { value: 'number', label: 'number' },
  { value: 'boolean', label: 'boolean' },
  { value: 'date', label: 'date' },
  { value: 'time', label: 'time' },
  { value: 'dateTime', label: 'dateTime' },
  { value: 'dayTimeDuration', label: 'dayTimeDuration' },
  { value: 'yearMonthDuration', label: 'yearMonthDuration' },
  { value: 'Any', label: 'Any' }
];

// Helper to get business object
function getBusinessObject(element: any): any {
  return element?.businessObject || element;
}

// Helper to check if element is of a specific type (using $instanceOf like dmn-js does)
function is(element: any, type: string): boolean {
  const bo = getBusinessObject(element);
  return bo && typeof bo.$instanceOf === 'function' && bo.$instanceOf(type);
}

// Helper to check if element is a Decision Output (output clause in decision table)
function isDecisionOutput(element: any): boolean {
  return is(element, 'dmn:OutputClause');
}

// Helper to check if element is a Decision node in the DRD
function isDecision(element: any): boolean {
  return is(element, 'dmn:Decision');
}

// Factory function to create TypeRef Entry Component with injected services for Decision nodes
function createDecisionTypeRefEntry(injector: any) {
  const modeling = injector.get('modeling');
  const translate = injector.get('translate');
  const drdFactory = injector.get('drdFactory');
  const commandStack = injector.get('commandStack');
  const eventBus = injector.get('eventBus');

  console.log('[DecisionTypeRefEntry] Services obtained from injector:');
  console.log('[DecisionTypeRefEntry] - modeling:', modeling);
  console.log('[DecisionTypeRefEntry] - commandStack:', commandStack);
  console.log('[DecisionTypeRefEntry] - eventBus:', eventBus);

  return function DecisionTypeRefEntry(props: { element: any; id: string }) {
    const { element, id } = props;

    console.log('[DecisionTypeRefEntry] Rendering with injected services');

    const getValue = () => {
      const bo = getBusinessObject(element);
      if (!bo) return '';

      // Try to get typeRef from variable first (same pattern as InputData)
      if (bo.variable && bo.variable.typeRef) {
        return bo.variable.typeRef;
      }

      return '';
    };

    const setValue = (value: string) => {
      const bo = getBusinessObject(element);
      if (!bo) {
        console.log('[DecisionTypeRefEntry] No business object found');
        return;
      }

      console.log('[DecisionTypeRefEntry] Setting value:', value);
      console.log('[DecisionTypeRefEntry] Business object:', bo);
      console.log('[DecisionTypeRefEntry] Element:', element);
      console.log('[DecisionTypeRefEntry] Element type:', typeof element);
      console.log('[DecisionTypeRefEntry] Element.id:', element?.id);
      console.log('[DecisionTypeRefEntry] Element.businessObject:', element?.businessObject);
      console.log('[DecisionTypeRefEntry] Is element a shape?:', element?.waypoints === undefined && element?.x !== undefined);
      console.log('[DecisionTypeRefEntry] Modeling service:', modeling);
      console.log('[DecisionTypeRefEntry] Modeling.updateProperties:', modeling?.updateProperties);

      // Get or create the variable (InformationItem)
      const variable = bo.variable;

      try {
        if (!variable) {
          console.log('[DecisionTypeRefEntry] Creating new variable');
          // Create InformationItem using drdFactory with the same name as the Decision
          const newVariable = drdFactory.create('dmn:InformationItem', {
            id: `${bo.id}_variable`,
            name: bo.name || bo.id,
            typeRef: value || undefined
          });
          newVariable.$parent = bo;

          console.log('[DecisionTypeRefEntry] New variable created:', newVariable);
          console.log('[DecisionTypeRefEntry] About to call modeling.updateProperties...');
          // Update Decision with the new variable
          const result = modeling.updateProperties(element, {
            variable: newVariable
          });
          console.log('[DecisionTypeRefEntry] updateProperties returned:', result);
          console.log('[DecisionTypeRefEntry] updateProperties called for new variable');
        } else {
          console.log('[DecisionTypeRefEntry] Updating existing variable:', variable);
          console.log('[DecisionTypeRefEntry] About to call modeling.updateModdleProperties...');
          // Update existing variable's typeRef using updateModdleProperties
          // This properly updates the property on the moddle element and triggers command stack
          const result = modeling.updateModdleProperties(element, variable, {
            typeRef: value || undefined
          });
          console.log('[DecisionTypeRefEntry] updateModdleProperties returned:', result);
          console.log('[DecisionTypeRefEntry] updateModdleProperties called');
        }
        console.log('[DecisionTypeRefEntry] After update, bo.variable:', bo.variable);
        console.log('[DecisionTypeRefEntry] After update, bo.variable?.typeRef:', bo.variable?.typeRef);

        // Debug: Check command stack state
        console.log('[DecisionTypeRefEntry] commandStack._stack length:', commandStack._stack?.length);
        console.log('[DecisionTypeRefEntry] commandStack._stackIdx:', commandStack._stackIdx);

        // Dispatch a custom DOM event that the main webview code can listen to
        // This bypasses the dmn-js event system isolation
        console.log('[DecisionTypeRefEntry] Dispatching custom propertiesChanged event');
        window.dispatchEvent(new CustomEvent('dmn-properties-changed', {
          detail: { source: 'decision-output' }
        }));
      } catch (err: any) {
        console.error('[DecisionTypeRefEntry] Error updating properties:', err);
        console.error('[DecisionTypeRefEntry] Error message:', err?.message);
        console.error('[DecisionTypeRefEntry] Error stack:', err?.stack);
      }
    };

    const getOptions = () => {
      return DMN_DATA_TYPES.map(type => ({
        value: type.value,
        label: translate ? translate(type.label) : type.label
      }));
    };

    return SelectEntry({
      id,
      element,
      label: translate ? translate('Output Data Type') : 'Output Data Type',
      getValue,
      setValue,
      getOptions
    });
  };
}

// Provider class - integrates with dmn-js-properties-panel
export default class DecisionOutputPropertiesProvider {
  static $inject = ['propertiesPanel', 'injector'];

  private _injector: any;
  private _decisionTypeRefEntryComponent: any;

  constructor(propertiesPanel: any, injector: any) {
    this._injector = injector;
    console.log('[DecisionOutputPropertiesProvider] Registering provider');

    // Create the TypeRefEntry component with injected services
    this._decisionTypeRefEntryComponent = createDecisionTypeRefEntry(injector);
    console.log('[DecisionOutputPropertiesProvider] DecisionTypeRefEntry component created');

    // Register with priority lower than default (1000) to add after standard properties
    propertiesPanel.registerProvider(500, this);
    console.log('[DecisionOutputPropertiesProvider] Provider registered successfully');
  }

  getGroups(element: any) {
    const decisionTypeRefEntry = this._decisionTypeRefEntryComponent;

    return (groups: any[]) => {
      const bo = getBusinessObject(element);
      console.log('[DecisionOutputPropertiesProvider] getGroups called for element:', bo?.$type);
      console.log('[DecisionOutputPropertiesProvider] isDecision:', isDecision(element));

      if (!isDecision(element)) {
        return groups;
      }

      console.log('[DecisionOutputPropertiesProvider] Adding Decision Output group');

      // Add Decision Output group with typeRef
      const decisionOutputGroup = {
        id: 'decisionOutput',
        label: 'Decision Output',
        component: Group,
        entries: [
          {
            id: 'decision-typeRef',
            component: decisionTypeRefEntry,
            element
          }
        ]
      };

      groups.push(decisionOutputGroup);

      return groups;
    };
  }
}
