/**
 * Event Colors Extension Module
 * Colors BPMN events (start, end, intermediate) to match palette icons
 */

// Color constants matching the palette icons
const COLORS = {
  startEvent: '#52c41a',  // Green
  endEvent: '#ff4d4f',    // Red
  intermediateEvent: '#fa8c16'  // Orange
};

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

function getEventColor(element: Element): string | null {
  const type = element.type || element.businessObject?.$type;

  if (!type) return null;

  if (type === 'bpmn:StartEvent') return COLORS.startEvent;
  if (type === 'bpmn:EndEvent') return COLORS.endEvent;
  if (type === 'bpmn:IntermediateThrowEvent') return COLORS.intermediateEvent;
  if (type === 'bpmn:IntermediateCatchEvent') return COLORS.intermediateEvent;

  return null;
}

function colorizeEvent(gfx: SVGGElement, color: string): void {
  const visual = gfx.querySelector('.djs-visual');
  if (!visual) return;

  // Color all circles using inline styles to override CSS
  const circles = visual.querySelectorAll('circle');
  circles.forEach((circle) => {
    (circle as SVGCircleElement).style.stroke = color;
  });

  // Color paths (for event markers like message, timer, etc.)
  const paths = visual.querySelectorAll('path');
  paths.forEach((path) => {
    const currentStroke = path.getAttribute('stroke');
    const currentFill = path.getAttribute('fill');

    if (currentStroke && currentStroke !== 'none') {
      (path as SVGPathElement).style.stroke = color;
    }
    if (currentFill && currentFill !== 'none' &&
        currentFill !== 'white' && currentFill !== '#fff' &&
        currentFill !== '#ffffff' && currentFill !== 'rgb(255, 255, 255)') {
      (path as SVGPathElement).style.fill = color;
    }
  });
}

function colorizeAllEvents(elementRegistry: ElementRegistry, canvas: Canvas): void {
  elementRegistry.forEach((element: Element) => {
    const color = getEventColor(element);
    if (color) {
      const gfx = canvas.getGraphics(element);
      if (gfx) {
        colorizeEvent(gfx, color);
      }
    }
  });
}

class EventColorsModule {
  static $inject = ['eventBus', 'canvas', 'elementRegistry'];

  constructor(eventBus: EventBus, canvas: Canvas, elementRegistry: ElementRegistry) {
    // Colorize after import is complete
    eventBus.on('import.done', () => {
      requestAnimationFrame(() => {
        colorizeAllEvents(elementRegistry, canvas);
      });
    });

    // Colorize when a new shape is added (for drag-and-drop)
    eventBus.on('shape.added', (event: unknown) => {
      const e = event as { element: Element };
      const element = e.element;
      const color = getEventColor(element);

      if (color) {
        requestAnimationFrame(() => {
          const gfx = canvas.getGraphics(element);
          if (gfx) {
            colorizeEvent(gfx, color);
          }
        });
      }
    });

    // Handle shape changes
    eventBus.on('shape.changed', (event: unknown) => {
      const e = event as { element: Element };
      const element = e.element;
      const color = getEventColor(element);

      if (color) {
        requestAnimationFrame(() => {
          const gfx = canvas.getGraphics(element);
          if (gfx) {
            colorizeEvent(gfx, color);
          }
        });
      }
    });
  }
}

export default {
  __init__: ['eventColorsModule'],
  eventColorsModule: ['type', EventColorsModule]
};
