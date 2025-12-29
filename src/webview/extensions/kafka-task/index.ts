/**
 * Kafka Task Extension Module
 * Combines all Kafka task components into a single module
 */

import KafkaTaskPaletteProvider from './palette-provider';
import KafkaTaskPropertiesProvider from './properties-provider';
import KafkaTaskRenderer from './renderer';
import kafkaTaskDescriptor from './moddle-descriptor';

// Export the moddle descriptor separately (needed for modeler config)
export { kafkaTaskDescriptor };

// Export the Kafka panel initializer
export { initKafkaPanel } from './kafka-panel';

// Export the module for bpmn-js additionalModules
export default {
  __init__: ['kafkaTaskPaletteProvider', 'kafkaTaskPropertiesProvider', 'kafkaTaskRenderer'],
  kafkaTaskPaletteProvider: ['type', KafkaTaskPaletteProvider],
  kafkaTaskPropertiesProvider: ['type', KafkaTaskPropertiesProvider],
  kafkaTaskRenderer: ['type', KafkaTaskRenderer]
};
