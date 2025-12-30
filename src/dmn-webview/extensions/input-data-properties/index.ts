/**
 * InputData Properties Extension
 * Provides data type (typeRef) configuration for InputData elements
 */

import InputDataPropertiesProvider from './properties-provider';

export default {
  __init__: ['inputDataPropertiesProvider'],
  inputDataPropertiesProvider: ['type', InputDataPropertiesProvider]
};
