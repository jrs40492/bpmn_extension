/**
 * Label Colors Extension Module
 * Makes external labels (gateways, events, sequence flows) visible on dark backgrounds
 * by setting text fill color via inline styles to override bpmn-js defaults.
 */

interface Element {
  id: string;
  type: string;
  labelTarget?: Element;
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

/**
 * Get the VS Code editor foreground color, falling back to light gray for dark themes.
 */
function getLabelColor(): string {
  const style = getComputedStyle(document.documentElement);
  return style.getPropertyValue('--vscode-editor-foreground').trim() || '#d4d4d4';
}

/**
 * Check if an element is an external label (rendered as separate text on the canvas).
 * External labels appear on events, gateways, and data objects.
 * They also appear on sequence flows (connections).
 */
function isExternalLabel(element: Element): boolean {
  return !!element.labelTarget;
}

/**
 * Check if an element is a connection (sequence flow, message flow, association).
 */
function isConnection(element: Element): boolean {
  const type = element.type;
  return type === 'bpmn:SequenceFlow' ||
    type === 'bpmn:MessageFlow' ||
    type === 'bpmn:Association';
}

/**
 * Apply the label color to all text elements within an SVG graphic.
 */
function colorizeLabelText(gfx: SVGGElement, color: string): void {
  const visual = gfx.querySelector('.djs-visual');
  if (!visual) return;

  const texts = visual.querySelectorAll('text');
  texts.forEach((text) => {
    (text as SVGTextElement).style.fill = color;
  });
}

/**
 * Colorize all external labels and connection labels in the diagram.
 */
function colorizeAllLabels(elementRegistry: ElementRegistry, canvas: Canvas): void {
  const color = getLabelColor();
  elementRegistry.forEach((element: Element) => {
    if (isExternalLabel(element) || isConnection(element)) {
      const gfx = canvas.getGraphics(element);
      if (gfx) {
        colorizeLabelText(gfx, color);
      }
    }
  });
}

class LabelColorsModule {
  static $inject = ['eventBus', 'canvas', 'elementRegistry'];

  constructor(eventBus: EventBus, canvas: Canvas, elementRegistry: ElementRegistry) {
    // Colorize after import is complete
    eventBus.on('import.done', () => {
      requestAnimationFrame(() => {
        colorizeAllLabels(elementRegistry, canvas);
      });
    });

    // Colorize when a new shape is added
    eventBus.on('shape.added', (event: unknown) => {
      const e = event as { element: Element };
      const element = e.element;

      if (isExternalLabel(element)) {
        requestAnimationFrame(() => {
          const gfx = canvas.getGraphics(element);
          if (gfx) {
            colorizeLabelText(gfx, getLabelColor());
          }
        });
      }
    });

    // Handle shape changes (e.g., label text updated)
    eventBus.on('shape.changed', (event: unknown) => {
      const e = event as { element: Element };
      const element = e.element;

      if (isExternalLabel(element)) {
        requestAnimationFrame(() => {
          const gfx = canvas.getGraphics(element);
          if (gfx) {
            colorizeLabelText(gfx, getLabelColor());
          }
        });
      }
    });

    // Handle connection labels
    eventBus.on('connection.added', (event: unknown) => {
      const e = event as { element: Element };
      const element = e.element;

      if (isConnection(element)) {
        requestAnimationFrame(() => {
          const gfx = canvas.getGraphics(element);
          if (gfx) {
            colorizeLabelText(gfx, getLabelColor());
          }
        });
      }
    });

    eventBus.on('connection.changed', (event: unknown) => {
      const e = event as { element: Element };
      const element = e.element;

      if (isConnection(element)) {
        requestAnimationFrame(() => {
          const gfx = canvas.getGraphics(element);
          if (gfx) {
            colorizeLabelText(gfx, getLabelColor());
          }
        });
      }
    });

    // Re-apply colors when entering/exiting token simulation mode
    // The simulation's NeutralElementColors module strips all colors on enter
    eventBus.on('tokenSimulation.toggleMode', () => {
      requestAnimationFrame(() => {
        colorizeAllLabels(elementRegistry, canvas);
      });
    });
  }
}

export default {
  __init__: ['labelColorsModule'],
  labelColorsModule: ['type', LabelColorsModule]
};
