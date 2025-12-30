/**
 * Gateway Direction Extension
 *
 * Adds gateway direction property to the properties panel for gateways.
 * This allows users to specify if a gateway is Converging, Diverging, Mixed, or Unspecified.
 */

import { is } from 'bpmn-js/lib/util/ModelUtil';
// @ts-expect-error - no type definitions available
import { SelectEntry } from '@bpmn-io/properties-panel';
// @ts-expect-error - no type definitions available
import { useService } from 'bpmn-js-properties-panel';

// Check if element is a gateway
function isGateway(element: any): boolean {
  return is(element, 'bpmn:Gateway');
}

// Gateway Direction Select component
function GatewayDirectionSelect(props: { element: any; id: string }) {
  const { element, id } = props;
  const commandStack = useService('commandStack');
  const translate = useService('translate');

  const businessObject = element.businessObject || element;

  const getValue = () => {
    return businessObject.gatewayDirection || 'Unspecified';
  };

  const setValue = (value: string) => {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: businessObject,
      properties: { gatewayDirection: value }
    });
  };

  const getOptions = () => [
    { value: 'Unspecified', label: translate('Unspecified') },
    { value: 'Converging', label: translate('Converging (joining)') },
    { value: 'Diverging', label: translate('Diverging (splitting)') },
    { value: 'Mixed', label: translate('Mixed (both)') }
  ];

  return SelectEntry({
    id,
    element,
    label: translate('Gateway Direction'),
    description: translate('Indicates the flow direction through this gateway'),
    getValue,
    setValue,
    getOptions
  });
}

// Create entries for gateway
function GatewayEntries(props: { element: any }) {
  const { element } = props;

  if (!isGateway(element)) {
    return [];
  }

  return [
    {
      id: 'gatewayDirection',
      component: GatewayDirectionSelect,
      isEdited: (element: any) => {
        const bo = element.businessObject || element;
        return bo.gatewayDirection && bo.gatewayDirection !== 'Unspecified';
      }
    }
  ];
}

/**
 * Gateway Direction Properties Provider
 */
class GatewayDirectionPropertiesProvider {
  static $inject = ['propertiesPanel'];

  constructor(propertiesPanel: any) {
    propertiesPanel.registerProvider(500, this);
  }

  getGroups(element: any) {
    return (groups: any[]) => {
      if (!isGateway(element)) {
        return groups;
      }

      // Find the general group and add gateway direction entry to it
      const generalGroup = groups.find((g: any) => g.id === 'general');
      if (generalGroup) {
        const entries = GatewayEntries({ element });
        generalGroup.entries = [...generalGroup.entries, ...entries];
      }

      return groups;
    };
  }
}

// Module definition
export default {
  __init__: ['gatewayDirectionPropertiesProvider'],
  gatewayDirectionPropertiesProvider: ['type', GatewayDirectionPropertiesProvider]
};
