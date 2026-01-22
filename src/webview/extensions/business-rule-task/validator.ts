/**
 * Business Rule Task Validator
 * Validates that DMN references in Business Rule Tasks point to existing DMN files
 */

import type { DmnFileInfo } from './properties-provider';
import { DMN_DATA_INPUTS } from './moddle-descriptor';
import type { ValidationIssue } from '../../../shared/message-types';

// Interface for BPMN elements from the element registry
interface BpmnElement {
  id: string;
  type: string;
  businessObject?: {
    $type: string;
    id?: string;
    name?: string;
    implementation?: string;
    ioSpecification?: {
      dataInputs?: Array<{ name?: string }>;
    };
    dataInputAssociations?: Array<{
      targetRef?: { name?: string };
      assignment?: Array<{
        from?: { body?: string };
      }>;
    }>;
  };
}

interface ElementRegistry {
  getAll(): BpmnElement[];
}

/**
 * Get the value of a data input from a business rule task element
 */
function getDataInputValue(element: BpmnElement, inputName: string): string {
  const bo = element.businessObject;
  if (!bo) return '';

  const associations = bo.dataInputAssociations || [];
  for (const assoc of associations) {
    const targetRef = assoc.targetRef;
    if (targetRef?.name === inputName) {
      const assignment = assoc.assignment?.[0];
      if (assignment?.from?.body !== undefined) {
        return assignment.from.body;
      }
    }
  }

  return '';
}

/**
 * Check if an element is a Business Rule Task with DMN implementation
 */
function isDmnBusinessRuleTask(element: BpmnElement): boolean {
  const bo = element.businessObject;
  if (!bo || bo.$type !== 'bpmn:BusinessRuleTask') return false;

  // Check if it has DMN-related data inputs (model, namespace, decision)
  const associations = bo.dataInputAssociations || [];
  const hasModelInput = associations.some(a => a.targetRef?.name === DMN_DATA_INPUTS.MODEL);
  const hasNamespaceInput = associations.some(a => a.targetRef?.name === DMN_DATA_INPUTS.NAMESPACE);

  return hasModelInput || hasNamespaceInput;
}

/**
 * Validate all Business Rule Tasks in the diagram against available DMN files
 */
export function validateBusinessRuleTasks(
  elementRegistry: ElementRegistry,
  availableDmnFiles: DmnFileInfo[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const elements = elementRegistry.getAll();

  for (const element of elements) {
    if (!isDmnBusinessRuleTask(element)) continue;

    const elementId = element.businessObject?.id || element.id;
    const elementName = element.businessObject?.name || elementId;

    // Get the DMN reference values
    const modelValue = getDataInputValue(element, DMN_DATA_INPUTS.MODEL);
    const namespaceValue = getDataInputValue(element, DMN_DATA_INPUTS.NAMESPACE);
    const decisionValue = getDataInputValue(element, DMN_DATA_INPUTS.DECISION);

    // Skip validation if no DMN model is configured yet
    if (!modelValue && !namespaceValue) {
      continue;
    }

    // Check if model is specified
    if (!modelValue) {
      issues.push({
        id: elementId,
        message: `Business Rule Task "${elementName}" has a namespace but no DMN model specified`,
        category: 'error',
        rule: 'dmn-model-required'
      });
      continue;
    }

    // Find matching DMN file by model name
    const matchingFile = availableDmnFiles.find(f => {
      // Match by modelName (from <definitions name="...">)
      if (f.modelName && f.modelName === modelValue) return true;
      // Fallback: match by filename without extension
      const fileNameWithoutExt = f.name.replace(/\.dmn$/i, '');
      if (fileNameWithoutExt === modelValue) return true;
      return false;
    });

    if (!matchingFile) {
      // No matching DMN file found
      const availableModels = availableDmnFiles
        .map(f => f.modelName || f.name.replace(/\.dmn$/i, ''))
        .filter(Boolean);

      let message = `Business Rule Task "${elementName}" references DMN model "${modelValue}" which does not exist in the workspace`;
      if (availableModels.length > 0) {
        message += `. Available models: ${availableModels.join(', ')}`;
      } else {
        message += `. No DMN files found in the workspace`;
      }

      issues.push({
        id: elementId,
        message,
        category: 'error',
        rule: 'dmn-model-not-found'
      });
      continue;
    }

    // Validate namespace matches
    if (namespaceValue && matchingFile.namespace && namespaceValue !== matchingFile.namespace) {
      issues.push({
        id: elementId,
        message: `Business Rule Task "${elementName}" has namespace "${namespaceValue}" but DMN file "${matchingFile.name}" has namespace "${matchingFile.namespace}"`,
        category: 'error',
        rule: 'dmn-namespace-mismatch'
      });
    }

    // Validate decision exists in the DMN file
    if (decisionValue) {
      const decisionExists = matchingFile.decisions.some(d => d.id === decisionValue);
      if (!decisionExists) {
        const availableDecisions = matchingFile.decisions.map(d => d.id).join(', ');
        issues.push({
          id: elementId,
          message: `Business Rule Task "${elementName}" references decision "${decisionValue}" which does not exist in DMN model "${modelValue}". Available decisions: ${availableDecisions || 'none'}`,
          category: 'error',
          rule: 'dmn-decision-not-found'
        });
      }
    } else if (matchingFile.decisions.length > 0) {
      // DMN file has decisions but none selected - this is a warning
      issues.push({
        id: elementId,
        message: `Business Rule Task "${elementName}" does not specify which decision to invoke from DMN model "${modelValue}"`,
        category: 'warn',
        rule: 'dmn-decision-not-specified'
      });
    }

    // Warn if DMN file is not in a standard Kogito/Quarkus resources location
    const filePath = matchingFile.path.toLowerCase();
    const isInResources = filePath.includes('/src/main/resources/') ||
                          filePath.includes('/resources/') ||
                          filePath.includes('\\src\\main\\resources\\') ||
                          filePath.includes('\\resources\\');
    if (!isInResources) {
      issues.push({
        id: elementId,
        message: `DMN file "${matchingFile.name}" is not in a standard resources directory (src/main/resources). Kogito/Quarkus may not find it at runtime.`,
        category: 'warn',
        rule: 'dmn-file-location'
      });
    }
  }

  return issues;
}
