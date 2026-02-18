/**
 * Gateway Colors Extension Module
 * Colors BPMN gateways (exclusive, parallel, inclusive, complex, event-based)
 * with gold/orange based on element type rather than element ID.
 */

const GATEWAY_COLOR = '#faad14'; // Gold

const GATEWAY_TYPES = new Set([
  'bpmn:ExclusiveGateway',
  'bpmn:ParallelGateway',
  'bpmn:InclusiveGateway',
  'bpmn:ComplexGateway',
  'bpmn:EventBasedGateway'
]);

interface Element {
  id: string;
  type: string;
  businessObject?: {
    $type: string;
  };
}

interface EventBus {
  on: (event: string, callback: (e: unknown) => void) => void;
}

interface Canvas {
  getGraphics: (element: Element) => SVGGElement | null;
}

interface ElementRegistry {
  forEach: (callback: (element: Element) => void) => void;
}

function isGateway(element: Element): boolean {
  const type = element.type || element.businessObject?.$type;
  return !!type && GATEWAY_TYPES.has(type);
}

function colorizeGateway(gfx: SVGGElement): void {
  const visual = gfx.querySelector('.djs-visual');
  if (!visual) return;

  // Color gateway diamond (polygon)
  const polygons = visual.querySelectorAll('polygon');
  polygons.forEach((polygon) => {
    (polygon as SVGPolygonElement).style.stroke = GATEWAY_COLOR;
  });

  // Color gateway markers (paths)
  const paths = visual.querySelectorAll('path');
  paths.forEach((path) => {
    (path as SVGPathElement).style.stroke = GATEWAY_COLOR;
    (path as SVGPathElement).style.fill = GATEWAY_COLOR;
  });
}

function colorizeAllGateways(elementRegistry: ElementRegistry, canvas: Canvas): void {
  elementRegistry.forEach((element: Element) => {
    if (isGateway(element)) {
      const gfx = canvas.getGraphics(element);
      if (gfx) {
        colorizeGateway(gfx);
      }
    }
  });
}

class GatewayColorsModule {
  static $inject = ['eventBus', 'canvas', 'elementRegistry'];

  constructor(eventBus: EventBus, canvas: Canvas, elementRegistry: ElementRegistry) {
    eventBus.on('import.done', () => {
      requestAnimationFrame(() => {
        colorizeAllGateways(elementRegistry, canvas);
      });
    });

    eventBus.on('shape.added', (event: unknown) => {
      const e = event as { element: Element };
      if (isGateway(e.element)) {
        requestAnimationFrame(() => {
          const gfx = canvas.getGraphics(e.element);
          if (gfx) {
            colorizeGateway(gfx);
          }
        });
      }
    });

    eventBus.on('shape.changed', (event: unknown) => {
      const e = event as { element: Element };
      if (isGateway(e.element)) {
        requestAnimationFrame(() => {
          const gfx = canvas.getGraphics(e.element);
          if (gfx) {
            colorizeGateway(gfx);
          }
        });
      }
    });
  }
}

export default {
  __init__: ['gatewayColorsModule'],
  gatewayColorsModule: ['type', GatewayColorsModule]
};
