/**
 * Custom Renderer for REST Task
 * Detects REST tasks via drools:taskName="Rest" attribute (no custom extensions)
 */

import BaseRenderer from 'diagram-js/lib/draw/BaseRenderer';

const HIGH_PRIORITY = 1500;

interface Element {
  businessObject: {
    $type: string;
    get?: (name: string) => unknown;
    [key: string]: unknown;
  };
  width: number;
  height: number;
}

// Helper to check if element is a REST task
// Uses drools:taskName attribute - no custom extensions
function isRestTask(element: Element): boolean {
  const bo = element.businessObject;
  if (bo.$type !== 'bpmn:Task') return false;

  // Check for drools:taskName="Rest"
  const taskName = bo.get?.('drools:taskName') || bo['drools:taskName'];
  return taskName === 'Rest';
}

// SVG namespace
const SVG_NS = 'http://www.w3.org/2000/svg';

export default class RestTaskRenderer extends BaseRenderer {
  static $inject = ['eventBus', 'bpmnRenderer'];

  private bpmnRenderer: BaseRenderer;

  constructor(eventBus: unknown, bpmnRenderer: BaseRenderer) {
    // @ts-expect-error - eventBus type compatibility
    super(eventBus, HIGH_PRIORITY);
    this.bpmnRenderer = bpmnRenderer;
  }

  // @ts-expect-error - element type compatibility with base class
  canRender(element: Element): boolean {
    return isRestTask(element);
  }

  // @ts-expect-error - element type compatibility with base class
  drawShape(parentNode: SVGElement, element: Element): SVGElement {
    // First, let the default renderer draw the base shape
    // @ts-expect-error - element type compatibility
    const shape = this.bpmnRenderer.drawShape(parentNode, element);

    // Add REST indicator badge
    const badge = document.createElementNS(SVG_NS, 'g');
    badge.setAttribute('class', 'rest-task-badge');

    // Badge background
    const badgeBg = document.createElementNS(SVG_NS, 'rect');
    badgeBg.setAttribute('x', String(element.width - 32));
    badgeBg.setAttribute('y', '2');
    badgeBg.setAttribute('width', '30');
    badgeBg.setAttribute('height', '14');
    badgeBg.setAttribute('rx', '3');
    badgeBg.setAttribute('fill', '#52c41a');
    badge.appendChild(badgeBg);

    // Badge text
    const badgeText = document.createElementNS(SVG_NS, 'text');
    badgeText.setAttribute('x', String(element.width - 17));
    badgeText.setAttribute('y', '12');
    badgeText.setAttribute('text-anchor', 'middle');
    badgeText.setAttribute('fill', 'white');
    badgeText.setAttribute('font-size', '9');
    badgeText.setAttribute('font-weight', 'bold');
    badgeText.setAttribute('font-family', 'Arial, sans-serif');
    badgeText.textContent = 'REST';
    badge.appendChild(badgeText);

    // Add API icon
    const apiIcon = document.createElementNS(SVG_NS, 'g');
    apiIcon.setAttribute('transform', 'translate(6, 4)');

    // Cloud/API symbol
    const iconPath = document.createElementNS(SVG_NS, 'path');
    iconPath.setAttribute('d', 'M4 8.5c0-1.5 1.2-2.7 2.7-2.7.3-1.5 1.6-2.6 3.3-2.6 1.5 0 2.8.9 3.2 2.3.2 0 .5-.1.8-.1 1.5 0 2.7 1.2 2.7 2.7s-1.2 2.7-2.7 2.7H6.7C5.2 10.8 4 9.7 4 8.5z');
    iconPath.setAttribute('fill', 'none');
    iconPath.setAttribute('stroke', '#1890ff');
    iconPath.setAttribute('stroke-width', '1.5');
    apiIcon.appendChild(iconPath);

    // Arrow indicating data transfer
    const arrow = document.createElementNS(SVG_NS, 'path');
    arrow.setAttribute('d', 'M8 12v4m0 0l-2-2m2 2l2-2');
    arrow.setAttribute('fill', 'none');
    arrow.setAttribute('stroke', '#1890ff');
    arrow.setAttribute('stroke-width', '1.5');
    arrow.setAttribute('stroke-linecap', 'round');
    apiIcon.appendChild(arrow);

    parentNode.appendChild(apiIcon);
    parentNode.appendChild(badge);

    return shape;
  }
}
