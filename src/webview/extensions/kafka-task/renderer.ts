/**
 * Custom Renderer for Kafka Task
 * Adds a distinct visual style to Kafka tasks
 */

import BaseRenderer from 'diagram-js/lib/draw/BaseRenderer';

const HIGH_PRIORITY = 1500;

interface Element {
  businessObject: {
    $type: string;
    extensionElements?: {
      values?: Array<{
        $type: string;
        operation?: string;
      }>;
    };
  };
  width: number;
  height: number;
}

interface Shape {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Helper to check if element is a Kafka task
function isKafkaTask(element: Element): boolean {
  const bo = element.businessObject;
  if (bo.$type !== 'bpmn:SendTask' && bo.$type !== 'bpmn:ReceiveTask' && bo.$type !== 'bpmn:ServiceTask') {
    return false;
  }

  const extensionElements = bo.extensionElements;
  if (!extensionElements?.values) return false;

  return extensionElements.values.some(
    (ext) => ext.$type === 'kafka:KafkaTaskConfig'
  );
}

// Get Kafka operation type
function getKafkaOperation(element: Element): string {
  const bo = element.businessObject;
  const extensionElements = bo.extensionElements;
  if (!extensionElements?.values) return 'publish';

  const kafkaConfig = extensionElements.values.find(
    (ext) => ext.$type === 'kafka:KafkaTaskConfig'
  );

  return kafkaConfig?.operation || 'publish';
}

// SVG namespace
const SVG_NS = 'http://www.w3.org/2000/svg';

export default class KafkaTaskRenderer extends BaseRenderer {
  static $inject = ['eventBus', 'bpmnRenderer'];

  private bpmnRenderer: BaseRenderer;

  constructor(eventBus: unknown, bpmnRenderer: BaseRenderer) {
    // @ts-expect-error - eventBus type compatibility
    super(eventBus, HIGH_PRIORITY);
    this.bpmnRenderer = bpmnRenderer;
  }

  // @ts-expect-error - element type compatibility with base class
  canRender(element: Element): boolean {
    return isKafkaTask(element);
  }

  // @ts-expect-error - element type compatibility with base class
  drawShape(parentNode: SVGElement, element: Element): SVGElement {
    // First, let the default renderer draw the base shape
    // @ts-expect-error - element type compatibility
    const shape = this.bpmnRenderer.drawShape(parentNode, element);

    const operation = getKafkaOperation(element);
    const isProducer = operation === 'publish';

    // Add Kafka indicator badge
    const badge = document.createElementNS(SVG_NS, 'g');
    badge.setAttribute('class', 'kafka-task-badge');

    // Badge background - orange for Kafka
    const badgeBg = document.createElementNS(SVG_NS, 'rect');
    badgeBg.setAttribute('x', String(element.width - 42));
    badgeBg.setAttribute('y', '2');
    badgeBg.setAttribute('width', '40');
    badgeBg.setAttribute('height', '14');
    badgeBg.setAttribute('rx', '3');
    badgeBg.setAttribute('fill', isProducer ? '#ff6b35' : '#6b5bff');
    badge.appendChild(badgeBg);

    // Badge text
    const badgeText = document.createElementNS(SVG_NS, 'text');
    badgeText.setAttribute('x', String(element.width - 22));
    badgeText.setAttribute('y', '12');
    badgeText.setAttribute('text-anchor', 'middle');
    badgeText.setAttribute('fill', 'white');
    badgeText.setAttribute('font-size', '8');
    badgeText.setAttribute('font-weight', 'bold');
    badgeText.setAttribute('font-family', 'Arial, sans-serif');
    badgeText.textContent = 'KAFKA';
    badge.appendChild(badgeText);

    // Add Kafka icon (simplified streaming lines)
    const kafkaIcon = document.createElementNS(SVG_NS, 'g');
    kafkaIcon.setAttribute('transform', 'translate(6, 4)');

    // Kafka logo simplified - streaming lines
    const line1 = document.createElementNS(SVG_NS, 'path');
    line1.setAttribute('d', 'M2 4 L10 4');
    line1.setAttribute('fill', 'none');
    line1.setAttribute('stroke', isProducer ? '#ff6b35' : '#6b5bff');
    line1.setAttribute('stroke-width', '2');
    line1.setAttribute('stroke-linecap', 'round');
    kafkaIcon.appendChild(line1);

    const line2 = document.createElementNS(SVG_NS, 'path');
    line2.setAttribute('d', 'M2 8 L14 8');
    line2.setAttribute('fill', 'none');
    line2.setAttribute('stroke', isProducer ? '#ff6b35' : '#6b5bff');
    line2.setAttribute('stroke-width', '2');
    line2.setAttribute('stroke-linecap', 'round');
    kafkaIcon.appendChild(line2);

    const line3 = document.createElementNS(SVG_NS, 'path');
    line3.setAttribute('d', 'M2 12 L10 12');
    line3.setAttribute('fill', 'none');
    line3.setAttribute('stroke', isProducer ? '#ff6b35' : '#6b5bff');
    line3.setAttribute('stroke-width', '2');
    line3.setAttribute('stroke-linecap', 'round');
    kafkaIcon.appendChild(line3);

    // Arrow indicating direction
    if (isProducer) {
      // Arrow pointing right (outgoing)
      const arrow = document.createElementNS(SVG_NS, 'path');
      arrow.setAttribute('d', 'M12 8 L16 8 M14 6 L16 8 L14 10');
      arrow.setAttribute('fill', 'none');
      arrow.setAttribute('stroke', '#ff6b35');
      arrow.setAttribute('stroke-width', '1.5');
      arrow.setAttribute('stroke-linecap', 'round');
      arrow.setAttribute('stroke-linejoin', 'round');
      kafkaIcon.appendChild(arrow);
    } else {
      // Arrow pointing left (incoming)
      const arrow = document.createElementNS(SVG_NS, 'path');
      arrow.setAttribute('d', 'M16 8 L12 8 M14 6 L12 8 L14 10');
      arrow.setAttribute('fill', 'none');
      arrow.setAttribute('stroke', '#6b5bff');
      arrow.setAttribute('stroke-width', '1.5');
      arrow.setAttribute('stroke-linecap', 'round');
      arrow.setAttribute('stroke-linejoin', 'round');
      kafkaIcon.appendChild(arrow);
    }

    parentNode.appendChild(kafkaIcon);
    parentNode.appendChild(badge);

    return shape;
  }
}
