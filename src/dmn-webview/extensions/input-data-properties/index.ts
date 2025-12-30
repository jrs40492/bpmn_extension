/**
 * InputData Properties Extension
 * Provides data type (typeRef) configuration for InputData elements
 * and ensures variable name synchronization
 */

import InputDataPropertiesProvider from './properties-provider';
import InputDataBehavior from './input-data-behavior';

export default {
  __init__: ['inputDataPropertiesProvider', 'inputDataBehavior'],
  inputDataPropertiesProvider: ['type', InputDataPropertiesProvider],
  inputDataBehavior: ['type', InputDataBehavior]
};
