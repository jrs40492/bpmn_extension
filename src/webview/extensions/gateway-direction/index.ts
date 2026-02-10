/**
 * Gateway Direction Extension
 *
 * Adds gateway direction property to the properties panel for gateways.
 * This allows users to specify if a gateway is Converging, Diverging, Mixed, or Unspecified.
 */

import { is } from 'bpmn-js/lib/util/ModelUtil';

// Type definitions for properties panel components
import type { SelectEntry as SelectEntryFn } from '@bpmn-io/properties-panel';
// @ts-expect-error - no type definitions available
import type { useService as useServiceFn } from 'bpmn-js-properties-panel';

import { SelectEntry } from '@bpmn-io/properties-panel';
// @ts-expect-error - no type definitions available
import { useService } from 'bpmn-js-properties-panel';

// Extended types for properties panel entries that include runtime-supported properties
interface ExtendedSelectEntryProps {
  id: string;
  element: unknown;
  label: string;
  description?: string;
  getValue: () => string;
  setValue: (value: string) => void;
  getOptions: () => Array<{ value: string; label: string }>;
}

// ============================================================================
// BPMN-JS Type Definitions (no official types available)
// ============================================================================

interface ModdleElement {
  $type: string;
  $parent?: ModdleElement;
}

interface GatewayBusinessObject extends ModdleElement {
  gatewayDirection?: 'Unspecified' | 'Converging' | 'Diverging' | 'Mixed';
}

interface BpmnElement {
  businessObject?: GatewayBusinessObject;
}

interface CommandStack {
  execute(command: string, context: Record<string, unknown>): void;
}

interface PropertiesPanel {
  registerProvider(priority: number, provider: unknown): void;
}

interface PropertyEntry {
  id: string;
  component: (props: { element: BpmnElement; id: string }) => unknown;
  isEdited: (element: BpmnElement) => boolean;
}

interface PropertiesGroup {
  id: string;
  label?: string;
  entries: PropertyEntry[];
}

// ============================================================================
// Helper Functions
// ============================================================================

// Check if element is a gateway
function isGateway(element: BpmnElement): boolean {
  return is(element, 'bpmn:Gateway');
}

// ============================================================================
// Property Panel Components
// ============================================================================

// Gateway Direction Select component
function GatewayDirectionSelect(props: { element: BpmnElement; id: string }) {
  const { element, id } = props;
  const commandStack = useService('commandStack') as CommandStack;
  const translate = useService('translate') as (text: string) => string;

  const businessObject = element.businessObject || element;

  const getValue = () => {
    return (businessObject as GatewayBusinessObject).gatewayDirection || 'Unspecified';
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
  } as ExtendedSelectEntryProps);
}

// Create entries for gateway
function GatewayEntries(props: { element: BpmnElement }): PropertyEntry[] {
  const { element } = props;

  if (!isGateway(element)) {
    return [];
  }

  return [
    {
      id: 'gatewayDirection',
      component: GatewayDirectionSelect,
      isEdited: (element: BpmnElement) => {
        const bo = (element.businessObject || element) as GatewayBusinessObject;
        return !!bo.gatewayDirection && bo.gatewayDirection !== 'Unspecified';
      }
    }
  ];
}

// ============================================================================
// Properties Provider Class
// ============================================================================

class GatewayDirectionPropertiesProvider {
  static $inject = ['propertiesPanel', 'injector'];

  private injector: unknown;

  constructor(propertiesPanel: PropertiesPanel, injector: unknown) {
    this.injector = injector;
    propertiesPanel.registerProvider(500, this);
  }

  getGroups(element: BpmnElement) {
    return (groups: PropertiesGroup[]) => {
      if (!isGateway(element)) {
        return groups;
      }

      const bo = element.businessObject as GatewayBusinessObject;

      // Auto-set gateway direction if not set (required by jBPM)
      if (!bo?.gatewayDirection) {
        const commandStack = (this.injector as { get: (name: string) => CommandStack }).get('commandStack');

        // Calculate direction based on incoming/outgoing flows
        const incoming = (bo as unknown as { incoming?: unknown[] })?.incoming || [];
        const outgoing = (bo as unknown as { outgoing?: unknown[] })?.outgoing || [];

        let direction: 'Diverging' | 'Converging' | 'Mixed' | 'Unspecified' = 'Diverging';
        if (incoming.length > 1 && outgoing.length > 1) {
          direction = 'Mixed';
        } else if (incoming.length > 1) {
          direction = 'Converging';
        } else if (outgoing.length > 1) {
          direction = 'Diverging';
        }

        commandStack.execute('element.updateModdleProperties', {
          element,
          moddleElement: bo,
          properties: { gatewayDirection: direction }
        });
      }

      // Find the general group and add gateway direction entry to it
      const generalGroup = groups.find((g: PropertiesGroup) => g.id === 'general');
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
