/**
 * Moddle descriptor for User Task Form extension
 * Defines form field definitions that can be configured on User Tasks
 *
 * This extension allows users to:
 * - Define form fields with names, types, and sections (input/output)
 * - Support dot-notation for nested fields (e.g. pull_request.author)
 * - Persist field definitions in BPMN extensionElements
 *
 * The output is stored as:
 * <utform:formDefinition>
 *   <utform:formField name="pull_request.author" type="string" section="input" />
 * </utform:formDefinition>
 */
export const userTaskFormDescriptor = {
  name: 'UserTaskForm',
  prefix: 'utform',
  uri: 'http://bamoe.io/schema/user-task-form',
  xml: {
    tagAlias: 'lowerCase'
  },
  types: [
    {
      name: 'FormDefinition',
      superClass: ['Element'],
      properties: [
        {
          name: 'fields',
          type: 'FormField',
          isMany: true
        }
      ]
    },
    {
      name: 'FormField',
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
          name: 'section',
          type: 'String',
          isAttr: true,
          default: 'input'
        },
        {
          name: 'defaultValue',
          type: 'String',
          isAttr: true
        },
        {
          name: 'variable',
          type: 'String',
          isAttr: true
        }
      ]
    }
  ],
  enumerations: [],
  associations: []
};

export default userTaskFormDescriptor;
