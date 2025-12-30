/**
 * Business Rule Task Extension Module
 * Combines all Business Rule Task components into a single module
 */

import BusinessRuleTaskPropertiesProvider, { setAvailableDmnFiles, DmnFileInfo } from './properties-provider';
import BusinessRuleTaskRenderer from './renderer';
import businessRuleTaskDescriptor from './moddle-descriptor';

// Export the moddle descriptor separately (needed for modeler config)
export { businessRuleTaskDescriptor };

// Export DMN file management functions
export { setAvailableDmnFiles };
export type { DmnFileInfo };

// Export the module for bpmn-js additionalModules
export default {
  __init__: ['businessRuleTaskPropertiesProvider', 'businessRuleTaskRenderer'],
  businessRuleTaskPropertiesProvider: ['type', BusinessRuleTaskPropertiesProvider],
  businessRuleTaskRenderer: ['type', BusinessRuleTaskRenderer]
};
