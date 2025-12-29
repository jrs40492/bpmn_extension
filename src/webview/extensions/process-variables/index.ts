/**
 * Process Variables Extension Module
 * Adds support for defining input parameters/variables at the process level
 */

import ProcessVariablesPropertiesProvider from './properties-provider';
import processVariablesDescriptor from './moddle-descriptor';

// Export the moddle descriptor separately (needed for modeler config)
export { processVariablesDescriptor };

// Export the module for bpmn-js additionalModules
export default {
  __init__: ['processVariablesPropertiesProvider'],
  processVariablesPropertiesProvider: ['type', ProcessVariablesPropertiesProvider]
};
