/**
 * Moddle descriptor for Process Variables extension
 * Defines input parameters/variables that can be passed into a BPMN process
 */
export const processVariablesDescriptor = {
  name: 'BAMOE',
  prefix: 'bamoe',
  uri: 'http://bamoe.io/schema/process',
  xml: {
    tagAlias: 'lowerCase'
  },
  types: [
    {
      name: 'ProcessVariables',
      superClass: ['Element'],
      properties: [
        {
          name: 'variables',
          type: 'Variable',
          isMany: true
        }
      ]
    },
    {
      name: 'Variable',
      superClass: ['Element'],
      properties: [
        {
          name: 'name',
          type: 'String',
          isAttr: true
        },
        {
          name: 'type',
          type: 'String',
          isAttr: true,
          default: 'string'
        },
        {
          name: 'required',
          type: 'Boolean',
          isAttr: true,
          default: false
        },
        {
          name: 'defaultValue',
          type: 'String',
          isAttr: true
        },
        {
          name: 'description',
          type: 'String',
          isAttr: true
        }
      ]
    }
  ],
  enumerations: [],
  associations: []
};

export default processVariablesDescriptor;
