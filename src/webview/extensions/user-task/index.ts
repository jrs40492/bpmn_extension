/**
 * User Task Extension Module
 * Adds properties panel support for User Task configuration and data I/O mappings
 */

import UserTaskPropertiesProvider from './properties-provider';

export default {
  __init__: ['userTaskPropertiesProvider'],
  userTaskPropertiesProvider: ['type', UserTaskPropertiesProvider]
};
