/**
 * Message Event Extension Module
 * Provides properties panel configuration for Start Message Events
 *
 * Features:
 * - Message name configuration
 * - Payload fields definition (name, type)
 * - Output mappings to process variables
 */

import MessageEventPropertiesProvider from './properties-provider';
import messageEventDescriptor from './moddle-descriptor';

// Export the moddle descriptor separately (needed for modeler config)
export { messageEventDescriptor };

// Export the module for bpmn-js additionalModules
export default {
  __init__: ['messageEventPropertiesProvider'],
  messageEventPropertiesProvider: ['type', MessageEventPropertiesProvider]
};
