/**
 * InputData Properties Provider
 * Adds data type (typeRef) configuration to InputData elements in DMN DRD view
 */

import { SelectEntry, Group } from '@bpmn-io/properties-panel';
import { useService } from 'dmn-js-properties-panel';

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

// Helper to check if element is InputData
function isInputData(element: any): boolean {
  const bo = getBusinessObject(element);
  return bo && bo.$type === 'dmn:InputData';
}

// Helper to get business object
function getBusinessObject(element: any): any {
  return element?.businessObject || element;
}

// TypeRef Entry Component
function TypeRefEntry(props: { element: any; id: string }) {
  const { element, id } = props;

  const modeling = useService('modeling');
  const translate = useService('translate');
  const dmnFactory = useService('dmnFactory');

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

    // Get or create the variable (InformationItem)
    let variable = bo.variable;

    if (!variable) {
      // Create InformationItem using dmnFactory with the same name as the InputData
      variable = dmnFactory.create('dmn:InformationItem', {
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
      const updatedVariable = dmnFactory.create('dmn:InformationItem', {
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
      label: translate(type.label)
    }));
  };

  return SelectEntry({
    id,
    element,
    label: translate('Data Type'),
    getValue,
    setValue,
    getOptions
  });
}

// Provider class - integrates with dmn-js-properties-panel
export default class InputDataPropertiesProvider {
  static $inject = ['propertiesPanel', 'injector'];

  private _injector: any;

  constructor(propertiesPanel: any, injector: any) {
    this._injector = injector;
    // Register with priority lower than default (1000) to add after standard properties
    propertiesPanel.registerProvider(500, this);
  }

  getGroups(element: any) {
    return (groups: any[]) => {
      if (!isInputData(element)) {
        return groups;
      }

      // Add Input Data group with typeRef
      const inputDataGroup = {
        id: 'inputData',
        label: 'Input Data',
        component: Group,
        entries: [
          {
            id: 'inputData-typeRef',
            component: TypeRefEntry,
            element
          }
        ]
      };

      groups.push(inputDataGroup);

      return groups;
    };
  }
}
