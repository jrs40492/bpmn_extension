/**
 * Moddle descriptor for Message Event extension
 * Defines payload fields that can be configured on Start Message Events
 *
 * This extension allows users to:
 * - Define message payload fields with names and types
 * - Map incoming message content to process variables
 *
 * The output is stored in extension elements and standard BPMN dataOutput/dataOutputAssociation
 */
export const messageEventDescriptor = {
  name: 'MessageEvent',
  prefix: 'msgevt',
  uri: 'http://bamoe.io/schema/message-event',
  xml: {
    tagAlias: 'lowerCase'
  },
  types: [
    {
      name: 'PayloadDefinition',
      superClass: ['Element'],
      properties: [
        {
          name: 'fields',
          type: 'PayloadField',
          isMany: true
        }
      ]
    },
    {
      name: 'PayloadField',
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
          name: 'expression',
          type: 'String',
          isAttr: true
        }
      ]
    }
  ],
  enumerations: [],
  associations: []
};

export default messageEventDescriptor;
