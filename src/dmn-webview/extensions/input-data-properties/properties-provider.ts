/**
 * InputData Properties Provider
 * Adds data type (typeRef) configuration to InputData elements in DMN DRD view
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

// Helper to check if element is InputData
function isInputData(element: any): boolean {
  return is(element, 'dmn:InputData');
}

// Factory function to create TypeRef Entry Component with injected services
function createTypeRefEntry(injector: any) {
  const modeling = injector.get('modeling');
  const translate = injector.get('translate');
  const drdFactory = injector.get('drdFactory');

  return function TypeRefEntry(props: { element: any; id: string }) {
    const { element, id } = props;

    console.log('[TypeRefEntry] Rendering with injected services');

    const getValue = () => {
      const bo = getBusinessObject(element);
      if (!bo) return '';

      // Try to get typeRef from variable first
      if (bo.variable && bo.variable.typeRef) {
        return bo.variable.typeRef;
      }

      return '';
    };

    const setValue = (value: string) => {
      const bo = getBusinessObject(element);
      if (!bo) return;

      console.log('[TypeRefEntry] Setting value:', value);

      // Get or create the variable (InformationItem)
      let variable = bo.variable;

      if (!variable) {
        // Create InformationItem using drdFactory with the same name as the InputData
        variable = drdFactory.create('dmn:InformationItem', {
          id: `${bo.id}_variable`,
          name: bo.name || bo.id,
          typeRef: value || undefined
        });
        variable.$parent = bo;

        // Update InputData with the new variable
        modeling.updateProperties(element, {
          variable: variable
        });
      } else {
        // Update existing variable's typeRef by updating the element
        // We need to create a new variable with updated typeRef
        const updatedVariable = drdFactory.create('dmn:InformationItem', {
          id: variable.id || `${bo.id}_variable`,
          name: variable.name || bo.name || bo.id,
          typeRef: value || undefined
        });
        updatedVariable.$parent = bo;

        modeling.updateProperties(element, {
          variable: updatedVariable
        });
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
      label: translate ? translate('Data Type') : 'Data Type',
      getValue,
      setValue,
      getOptions
    });
  };
}

// Provider class - integrates with dmn-js-properties-panel
export default class InputDataPropertiesProvider {
  static $inject = ['propertiesPanel', 'injector'];

  private _injector: any;
  private _typeRefEntryComponent: any;

  constructor(propertiesPanel: any, injector: any) {
    this._injector = injector;
    console.log('[InputDataPropertiesProvider] Registering provider');

    // Create the TypeRefEntry component with injected services
    this._typeRefEntryComponent = createTypeRefEntry(injector);
    console.log('[InputDataPropertiesProvider] TypeRefEntry component created');

    // Register with priority lower than default (1000) to add after standard properties
    propertiesPanel.registerProvider(500, this);
    console.log('[InputDataPropertiesProvider] Provider registered successfully');
  }

  getGroups(element: any) {
    const typeRefEntry = this._typeRefEntryComponent;

    return (groups: any[]) => {
      const bo = getBusinessObject(element);
      console.log('[InputDataPropertiesProvider] getGroups called for element:', bo?.$type);
      console.log('[InputDataPropertiesProvider] isInputData:', isInputData(element));

      if (!isInputData(element)) {
        return groups;
      }

      console.log('[InputDataPropertiesProvider] Adding Input Data group');

      // Add Input Data group with typeRef
      const inputDataGroup = {
        id: 'inputData',
        label: 'Input Data',
        component: Group,
        entries: [
          {
            id: 'inputData-typeRef',
            component: typeRefEntry,
            element
          }
        ]
      };

      groups.push(inputDataGroup);

      return groups;
    };
  }
}
