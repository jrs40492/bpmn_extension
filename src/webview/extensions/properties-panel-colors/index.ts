/**
 * Properties Panel Colors Extension Module
 * Colors the properties panel header icon to match the selected element type
 */

// Color constants matching the palette and canvas colors
const COLORS: Record<string, string> = {
  // Events
  'bpmn:StartEvent': '#52c41a',           // Green
  'bpmn:EndEvent': '#ff4d4f',             // Red
  'bpmn:IntermediateThrowEvent': '#fa8c16', // Orange
  'bpmn:IntermediateCatchEvent': '#fa8c16', // Orange
  'bpmn:BoundaryEvent': '#fa8c16',        // Orange

  // Tasks
  'bpmn:Task': '#1890ff',                 // Blue
  'bpmn:ServiceTask': '#1890ff',          // Blue
  'bpmn:UserTask': '#1890ff',             // Blue
  'bpmn:ScriptTask': '#1890ff',           // Blue
  'bpmn:BusinessRuleTask': '#1890ff',     // Blue
  'bpmn:SendTask': '#1890ff',             // Blue
  'bpmn:ReceiveTask': '#1890ff',          // Blue
  'bpmn:ManualTask': '#1890ff',           // Blue
  'bpmn:CallActivity': '#1890ff',         // Blue

  // Gateways
  'bpmn:ExclusiveGateway': '#faad14',     // Gold
  'bpmn:ParallelGateway': '#faad14',      // Gold
  'bpmn:InclusiveGateway': '#faad14',     // Gold
  'bpmn:ComplexGateway': '#faad14',       // Gold
  'bpmn:EventBasedGateway': '#faad14',    // Gold

  // Subprocess
  'bpmn:SubProcess': '#722ed1',           // Indigo
  'bpmn:Transaction': '#722ed1',          // Indigo
  'bpmn:AdHocSubProcess': '#722ed1',      // Indigo

  // Data
  'bpmn:DataObjectReference': '#13c2c2',  // Cyan
  'bpmn:DataStoreReference': '#13c2c2',   // Cyan
  'bpmn:DataObject': '#13c2c2',           // Cyan

  // Participants/Pools
  'bpmn:Participant': '#08979c',          // Teal
  'bpmn:Lane': '#08979c',                 // Teal

  // Annotations
  'bpmn:TextAnnotation': '#b37feb',       // Light Purple
  'bpmn:Group': '#eb2f96',                // Pink

  // Connections
  'bpmn:SequenceFlow': '#8c8c8c',         // Gray
  'bpmn:MessageFlow': '#8c8c8c',          // Gray
  'bpmn:Association': '#8c8c8c',          // Gray
  'bpmn:DataInputAssociation': '#8c8c8c', // Gray
  'bpmn:DataOutputAssociation': '#8c8c8c',// Gray

  // Process
  'bpmn:Process': '#1890ff',              // Blue
  'bpmn:Collaboration': '#08979c',        // Teal
};

// Default color for unknown types
const DEFAULT_COLOR = '#8c8c8c';

interface Element {
  id: string;
  type: string;
  businessObject?: {
    $type: string;
  };
}

interface SelectionChangedEvent {
  newSelection: Element[];
  oldSelection: Element[];
}

interface EventBus {
  on: (event: string, callback: (e: unknown) => void) => void;
}

function getElementColor(element: Element): string {
  const type = element.type || element.businessObject?.$type;
  if (!type) return DEFAULT_COLOR;
  return COLORS[type] || DEFAULT_COLOR;
}

function updatePropertiesPanelHeaderColor(color: string): void {
  // Find the properties panel header icon
  const headerIcon = document.querySelector('.bio-properties-panel-header-icon');
  if (!headerIcon) return;

  // Find the SVG inside
  const svg = headerIcon.querySelector('svg');
  if (!svg) return;

  // Apply color to all paths and other SVG elements
  const paths = svg.querySelectorAll('path');
  paths.forEach((path) => {
    (path as SVGPathElement).style.fill = color;
  });

  // Also apply to circles, rects, polygons if any
  const circles = svg.querySelectorAll('circle');
  circles.forEach((circle) => {
    (circle as SVGCircleElement).style.stroke = color;
  });

  const rects = svg.querySelectorAll('rect');
  rects.forEach((rect) => {
    // Only color rects that have a fill (not transparent background rects)
    const currentFill = rect.getAttribute('fill');
    if (currentFill && currentFill !== 'none' && currentFill !== 'transparent') {
      (rect as SVGRectElement).style.fill = color;
    }
    const currentStroke = rect.getAttribute('stroke');
    if (currentStroke && currentStroke !== 'none') {
      (rect as SVGRectElement).style.stroke = color;
    }
  });

  const polygons = svg.querySelectorAll('polygon');
  polygons.forEach((polygon) => {
    (polygon as SVGPolygonElement).style.fill = color;
    (polygon as SVGPolygonElement).style.stroke = color;
  });

  // Set the CSS custom property as well (for any elements that use it)
  (headerIcon as HTMLElement).style.setProperty('--header-icon-fill-color', color);
  svg.style.fill = color;
}

class PropertiesPanelColorsModule {
  static $inject = ['eventBus'];

  constructor(eventBus: EventBus) {
    // Listen to selection changes
    eventBus.on('selection.changed', (event: unknown) => {
      const e = event as SelectionChangedEvent;

      if (e.newSelection && e.newSelection.length > 0) {
        const element = e.newSelection[0];
        const color = getElementColor(element);

        // Use requestAnimationFrame to ensure the properties panel has updated
        requestAnimationFrame(() => {
          updatePropertiesPanelHeaderColor(color);
        });
      }
    });

    // Also listen for element changes in case the type changes
    eventBus.on('element.changed', (event: unknown) => {
      const e = event as { element: Element };
      const color = getElementColor(e.element);

      requestAnimationFrame(() => {
        updatePropertiesPanelHeaderColor(color);
      });
    });
  }
}

export default {
  __init__: ['propertiesPanelColorsModule'],
  propertiesPanelColorsModule: ['type', PropertiesPanelColorsModule]
};
