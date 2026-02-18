/**
 * Moddle descriptor for Multi-Error Boundary Event extension
 * Defines the ErrorCodeList element containing ErrorCode children,
 * enabling a single visual boundary event to represent
 * multiple BPMN-compliant error boundary events on export.
 */
export const errorBoundaryDescriptor = {
  name: 'ErrorBoundary',
  prefix: 'errbnd',
  uri: 'http://bamoe.io/schema/error-boundary',
  xml: {
    tagAlias: 'lowerCase'
  },
  types: [
    {
      name: 'ErrorCodeList',
      superClass: ['Element'],
      properties: [
        {
          name: 'codes',
          type: 'errbnd:ErrorCode',
          isMany: true
        },
        {
          name: 'groupId',
          type: 'String',
          isAttr: true
        },
        {
          name: 'targetVariable',
          type: 'String',
          isAttr: true
        }
      ]
    },
    {
      name: 'ErrorCode',
      superClass: ['Element'],
      properties: [
        {
          name: 'code',
          type: 'String',
          isAttr: true
        }
      ]
    }
  ],
  enumerations: [],
  associations: []
};

export default errorBoundaryDescriptor;
