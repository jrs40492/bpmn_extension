/**
 * REST Task Extension Module
 * Combines all REST task components into a single module
 * Includes Kogito-compatible data mappings
 */

import RestTaskPaletteProvider from './palette-provider';
import RestTaskPropertiesProvider from './properties-provider';
import RestTaskRenderer from './renderer';
import restTaskDescriptor from './moddle-descriptor';
import droolsDescriptor from './drools-descriptor';

// Export the moddle descriptors separately (needed for modeler config)
export { restTaskDescriptor, droolsDescriptor };

// Export Kogito mapping utilities
export { createKogitoDataMappings, KOGITO_REST_PARAMS } from './palette-provider';

// Export the module for bpmn-js additionalModules
export default {
  __init__: ['restTaskPaletteProvider', 'restTaskPropertiesProvider', 'restTaskRenderer'],
  restTaskPaletteProvider: ['type', RestTaskPaletteProvider],
  restTaskPropertiesProvider: ['type', RestTaskPropertiesProvider],
  restTaskRenderer: ['type', RestTaskRenderer]
};
