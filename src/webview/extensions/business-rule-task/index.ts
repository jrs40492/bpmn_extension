/**
 * Business Rule Task Extension Module
 * Combines all Business Rule Task components into a single module
 *
 * Uses Kogito/jBPM compatible format:
 * - implementation="http://www.jboss.org/drools/dmn" attribute
 * - Standard BPMN ioSpecification with dataInputs: model, namespace, decision
 */

import BusinessRuleTaskPropertiesProvider, { setAvailableDmnFiles, DmnFileInfo } from './properties-provider';
import BusinessRuleTaskRenderer from './renderer';
import businessRuleTaskDescriptor, { DMN_IMPLEMENTATION_URI, DMN_DATA_INPUTS } from './moddle-descriptor';

// Export the moddle descriptor separately (needed for modeler config)
export { businessRuleTaskDescriptor };

// Export DMN constants for use by other modules
export { DMN_IMPLEMENTATION_URI, DMN_DATA_INPUTS };

// Export DMN file management functions
export { setAvailableDmnFiles };
export type { DmnFileInfo };

// Export the module for bpmn-js additionalModules
export default {
  __init__: ['businessRuleTaskPropertiesProvider', 'businessRuleTaskRenderer'],
  businessRuleTaskPropertiesProvider: ['type', BusinessRuleTaskPropertiesProvider],
  businessRuleTaskRenderer: ['type', BusinessRuleTaskRenderer]
};
