/**
 * Moddle descriptor for Business Rule Task extension
 *
 * Uses Kogito/jBPM compatible format:
 * - implementation="http://www.jboss.org/drools/dmn" attribute on businessRuleTask
 * - Standard BPMN ioSpecification with dataInputs: model, namespace, decision
 * - Standard dataInputAssociation with assignments for values
 *
 * This is compatible with Kogito, jBPM, Drools, and IBM BAMOE runtime.
 */

// DMN implementation URI for Kogito/jBPM
export const DMN_IMPLEMENTATION_URI = 'http://www.jboss.org/drools/dmn';

// Data input names expected by Kogito DMN handler
export const DMN_DATA_INPUTS = {
  MODEL: 'model',      // Name of the DMN model (file name without extension)
  NAMESPACE: 'namespace', // DMN namespace URI
  DECISION: 'decision'    // Decision ID to invoke
} as const;

// Note: We don't need a custom moddle descriptor anymore since we're using
// standard BPMN elements (ioSpecification, dataInputAssociation).
// The 'implementation' attribute is already defined in the BPMN spec.
// We keep this file for exports and backward compatibility.

export const businessRuleTaskDescriptor = {
  name: 'BusinessRule',
  prefix: 'dmn',
  uri: 'http://bamoe.io/schema/dmn',
  xml: {
    tagAlias: 'lowerCase'
  },
  types: [
    // Keep DecisionTaskConfig for backward compatibility when reading old files
    // New saves will use the Kogito-compatible format
    {
      name: 'DecisionTaskConfig',
      superClass: ['Element'],
      properties: [
        {
          name: 'decisionRef',
          type: 'String',
          isAttr: true,
          description: 'The ID of the DMN decision to invoke'
        },
        {
          name: 'dmnFile',
          type: 'String',
          isAttr: true,
          description: 'Path to the DMN file containing the decision'
        },
        {
          name: 'dmnFileName',
          type: 'String',
          isAttr: true,
          description: 'Display name of the DMN file'
        },
        {
          name: 'resultVariable',
          type: 'String',
          isAttr: true,
          default: 'decisionResult',
          description: 'Variable name to store the decision result'
        },
        {
          name: 'mapDecisionResult',
          type: 'String',
          isAttr: true,
          default: 'singleResult',
          description: 'How to map the decision result (singleEntry, singleResult, collectEntries, resultList)'
        },
        {
          name: 'decisionRefBinding',
          type: 'String',
          isAttr: true,
          default: 'latest',
          description: 'How to bind the decision reference (latest, deployment, version)'
        },
        {
          name: 'decisionRefVersion',
          type: 'String',
          isAttr: true,
          description: 'Version number when using version binding'
        }
      ]
    }
  ],
  enumerations: [],
  associations: []
};

export default businessRuleTaskDescriptor;
