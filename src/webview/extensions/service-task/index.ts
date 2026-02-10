/**
 * Java Service Task Extension Module
 * Adds properties panel support for Java Service Task configuration
 */

import JavaServiceTaskPropertiesProvider from './properties-provider';

export default {
  __init__: ['javaServiceTaskPropertiesProvider'],
  javaServiceTaskPropertiesProvider: ['type', JavaServiceTaskPropertiesProvider]
};
