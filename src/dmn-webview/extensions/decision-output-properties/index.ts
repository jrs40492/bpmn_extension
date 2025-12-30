/**
 * Decision Output Properties Extension
 * Provides data type (typeRef) configuration for Decision Output elements
 */

import DecisionOutputPropertiesProvider from './properties-provider';

export default {
  __init__: ['decisionOutputPropertiesProvider'],
  decisionOutputPropertiesProvider: ['type', DecisionOutputPropertiesProvider]
};
