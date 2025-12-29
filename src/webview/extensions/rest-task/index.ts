/**
 * REST Task Extension Module
 * Combines all REST task components into a single module
 */

import RestTaskPaletteProvider from './palette-provider';
import RestTaskPropertiesProvider from './properties-provider';
import RestTaskRenderer from './renderer';
import restTaskDescriptor from './moddle-descriptor';

// Export the moddle descriptor separately (needed for modeler config)
export { restTaskDescriptor };

// Export the module for bpmn-js additionalModules
export default {
  __init__: ['restTaskPaletteProvider', 'restTaskPropertiesProvider', 'restTaskRenderer'],
  restTaskPaletteProvider: ['type', RestTaskPaletteProvider],
  restTaskPropertiesProvider: ['type', RestTaskPropertiesProvider],
  restTaskRenderer: ['type', RestTaskRenderer]
};
