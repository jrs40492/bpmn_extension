/**
 * Custom Renderer for Business Rule Task
 * Adds a visual indicator showing DMN decision linking
 *
 * Supports both:
 * - New Kogito format: ioSpecification with dataInputAssociations
 * - Legacy format: dmn:DecisionTaskConfig extension element
 */

import BaseRenderer from 'diagram-js/lib/draw/BaseRenderer';
import { DMN_IMPLEMENTATION_URI, DMN_DATA_INPUTS } from './moddle-descriptor';

const HIGH_PRIORITY = 1500;

interface Element {
  businessObject: {
    $type: string;
    name?: string;
    implementation?: string;
    dataInputAssociations?: Array<{
      targetRef?: { name?: string };
      assignment?: Array<{ from?: { body?: string } }>;
    }>;
    extensionElements?: {
      values?: Array<{
        $type: string;
        decisionRef?: string;
        dmnFileName?: string;
      }>;
    };
  };
  width: number;
  height: number;
}

// Helper to check if element is a Business Rule Task
function isBusinessRuleTask(element: Element): boolean {
  return element.businessObject?.$type === 'bpmn:BusinessRuleTask';
}

// Helper to get data input value from ioSpecification (Kogito format)
function getDataInputValue(element: Element, inputName: string): string {
  const bo = element.businessObject;
  if (!bo?.dataInputAssociations) return '';

  for (const assoc of bo.dataInputAssociations) {
    if (assoc.targetRef?.name === inputName) {
      const assignment = assoc.assignment?.[0];
      if (assignment?.from?.body !== undefined) {
        return assignment.from.body;
      }
    }
  }
  return '';
}

// Helper to get decision config (supports both new and legacy formats)
function getDecisionConfig(element: Element): { decisionRef?: string; dmnFileName?: string } | null {
  const bo = element.businessObject;

  // Check new Kogito format first
  if (bo?.implementation === DMN_IMPLEMENTATION_URI || bo?.dataInputAssociations?.length) {
    const model = getDataInputValue(element, DMN_DATA_INPUTS.MODEL);
    const decision = getDataInputValue(element, DMN_DATA_INPUTS.DECISION);
    if (model || decision) {
      return {
        decisionRef: decision,
        dmnFileName: model
      };
    }
  }

  // Fall back to legacy format
  const extensionElements = bo?.extensionElements;
  if (!extensionElements?.values) return null;

  return extensionElements.values.find(
    (ext) => ext.$type === 'dmn:DecisionTaskConfig'
  ) || null;
}

// SVG namespace
const SVG_NS = 'http://www.w3.org/2000/svg';

export default class BusinessRuleTaskRenderer extends BaseRenderer {
  static $inject = ['eventBus', 'bpmnRenderer'];

  private bpmnRenderer: BaseRenderer;

  constructor(eventBus: unknown, bpmnRenderer: BaseRenderer) {
    // @ts-expect-error - eventBus type compatibility
    super(eventBus, HIGH_PRIORITY);
    this.bpmnRenderer = bpmnRenderer;
  }

  // @ts-expect-error - element type compatibility with base class
  canRender(element: Element): boolean {
    return isBusinessRuleTask(element);
  }

  // @ts-expect-error - element type compatibility with base class
  drawShape(parentNode: SVGElement, element: Element): SVGElement {
    // First, let the default renderer draw the base shape
    // @ts-expect-error - element type compatibility
    const shape = this.bpmnRenderer.drawShape(parentNode, element);

    const decisionConfig = getDecisionConfig(element);
    const hasLinkedDecision = decisionConfig?.decisionRef;

    // Add DMN indicator badge
    const badge = document.createElementNS(SVG_NS, 'g');
    badge.setAttribute('class', 'dmn-task-badge');

    // Badge background - blue for linked, gray for unlinked
    const badgeBg = document.createElementNS(SVG_NS, 'rect');
    badgeBg.setAttribute('x', String(element.width - 32));
    badgeBg.setAttribute('y', '2');
    badgeBg.setAttribute('width', '30');
    badgeBg.setAttribute('height', '14');
    badgeBg.setAttribute('rx', '3');
    badgeBg.setAttribute('fill', hasLinkedDecision ? '#1890ff' : '#6e6e6e');
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
    badgeText.textContent = 'DMN';
    badge.appendChild(badgeText);

    parentNode.appendChild(badge);

    // Add linked decision indicator if configured
    if (hasLinkedDecision) {
      const linkedIndicator = document.createElementNS(SVG_NS, 'g');
      linkedIndicator.setAttribute('class', 'dmn-linked-indicator');

      // Link icon background
      const linkBg = document.createElementNS(SVG_NS, 'rect');
      linkBg.setAttribute('x', '2');
      linkBg.setAttribute('y', String(element.height - 18));
      linkBg.setAttribute('width', String(Math.min(element.width - 4, 100)));
      linkBg.setAttribute('height', '16');
      linkBg.setAttribute('rx', '2');
      linkBg.setAttribute('fill', 'rgba(24, 144, 255, 0.15)');
      linkBg.setAttribute('stroke', '#1890ff');
      linkBg.setAttribute('stroke-width', '1');
      linkedIndicator.appendChild(linkBg);

      // Link icon
      const linkIcon = document.createElementNS(SVG_NS, 'text');
      linkIcon.setAttribute('x', '6');
      linkIcon.setAttribute('y', String(element.height - 6));
      linkIcon.setAttribute('fill', '#1890ff');
      linkIcon.setAttribute('font-size', '10');
      linkIcon.textContent = '🔗';
      linkedIndicator.appendChild(linkIcon);

      // Decision name (truncated)
      const decisionName = decisionConfig.decisionRef || '';
      const displayName = decisionName.length > 12 ? decisionName.substring(0, 10) + '...' : decisionName;

      const nameText = document.createElementNS(SVG_NS, 'text');
      nameText.setAttribute('x', '18');
      nameText.setAttribute('y', String(element.height - 6));
      nameText.setAttribute('fill', '#1890ff');
      nameText.setAttribute('font-size', '9');
      nameText.setAttribute('font-family', 'Arial, sans-serif');
      nameText.textContent = displayName;
      linkedIndicator.appendChild(nameText);

      parentNode.appendChild(linkedIndicator);
    } else {
      // Add "Configure" hint for unconfigured tasks
      const hintGroup = document.createElementNS(SVG_NS, 'g');
      hintGroup.setAttribute('class', 'dmn-configure-hint');

      const hintBg = document.createElementNS(SVG_NS, 'rect');
      hintBg.setAttribute('x', '2');
      hintBg.setAttribute('y', String(element.height - 18));
      hintBg.setAttribute('width', '70');
      hintBg.setAttribute('height', '16');
      hintBg.setAttribute('rx', '2');
      hintBg.setAttribute('fill', 'rgba(110, 110, 110, 0.15)');
      hintBg.setAttribute('stroke', '#6e6e6e');
      hintBg.setAttribute('stroke-width', '1');
      hintBg.setAttribute('stroke-dasharray', '2,2');
      hintGroup.appendChild(hintBg);

      const hintText = document.createElementNS(SVG_NS, 'text');
      hintText.setAttribute('x', '6');
      hintText.setAttribute('y', String(element.height - 6));
      hintText.setAttribute('fill', '#6e6e6e');
      hintText.setAttribute('font-size', '9');
      hintText.setAttribute('font-family', 'Arial, sans-serif');
      hintText.setAttribute('font-style', 'italic');
      hintText.textContent = '⚙ Configure';
      hintGroup.appendChild(hintText);

      parentNode.appendChild(hintGroup);
    }

    return shape;
  }
}
