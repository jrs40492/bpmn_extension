/**
 * REST Task Extension Module
 * Uses STANDARD BPMN elements only - no custom extensions
 *
 * Creates Kogito-compatible REST work items using:
 * - bpmn:task with drools:taskName="Rest"
 * - Standard bpmn:ioSpecification
 * - Standard bpmn:dataInputAssociation / dataOutputAssociation
 */

import RestTaskPaletteProvider from './palette-provider';
import RestTaskPropertiesProvider from './properties-provider';
import RestTaskRenderer from './renderer';

// Re-export the drools descriptor (still needed for drools:taskName attribute)
export { droolsDescriptor } from './drools-descriptor';

// Export helper functions
export { isRestTask, getRestConfig, updateRestParam, REST_PARAMS } from './palette-provider';

// Export the module for bpmn-js additionalModules
export default {
  __init__: ['restTaskPaletteProvider', 'restTaskPropertiesProvider', 'restTaskRenderer'],
  restTaskPaletteProvider: ['type', RestTaskPaletteProvider],
  restTaskPropertiesProvider: ['type', RestTaskPropertiesProvider],
  restTaskRenderer: ['type', RestTaskRenderer]
};
