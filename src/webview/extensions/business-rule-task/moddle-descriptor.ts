/**
 * Moddle descriptor for Business Rule Task extension
 * Defines custom properties for DMN decision linking
 */
export const businessRuleTaskDescriptor = {
  name: 'BusinessRule',
  prefix: 'dmn',
  uri: 'http://bamoe.io/schema/dmn',
  xml: {
    tagAlias: 'lowerCase'
  },
  types: [
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
