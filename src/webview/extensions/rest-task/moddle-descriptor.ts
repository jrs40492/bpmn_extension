/**
 * Moddle descriptor for REST Task extension
 * Defines custom properties that can be stored in BPMN XML
 */
export const restTaskDescriptor = {
  name: 'REST',
  prefix: 'rest',
  uri: 'http://bamoe.io/schema/rest',
  xml: {
    tagAlias: 'lowerCase'
  },
  types: [
    {
      name: 'RestTaskConfig',
      superClass: ['Element'],
      properties: [
        {
          name: 'url',
          type: 'String',
          isAttr: true
        },
        {
          name: 'method',
          type: 'String',
          isAttr: true,
          default: 'GET'
        },
        {
          name: 'headers',
          type: 'String',
          isAttr: true
        },
        {
          name: 'body',
          type: 'String',
          isAttr: true
        },
        {
          name: 'responseVariable',
          type: 'String',
          isAttr: true
        },
        {
          name: 'timeout',
          type: 'Integer',
          isAttr: true,
          default: 30000
        },
        {
          name: 'retryCount',
          type: 'Integer',
          isAttr: true,
          default: 0
        }
      ]
    }
  ],
  emumerations: [],
  associations: []
};

export default restTaskDescriptor;
