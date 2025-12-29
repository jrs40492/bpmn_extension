/**
 * Script Task Extension Module
 * Adds properties panel support for Script Task configuration
 */

import ScriptTaskPropertiesProvider from './properties-provider';

// Export the module for bpmn-js additionalModules
export default {
  __init__: ['scriptTaskPropertiesProvider'],
  scriptTaskPropertiesProvider: ['type', ScriptTaskPropertiesProvider]
};
