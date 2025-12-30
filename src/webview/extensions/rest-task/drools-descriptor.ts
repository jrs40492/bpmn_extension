/**
 * Moddle descriptor for Drools/Kogito extension elements
 * Required for Kogito runtime compatibility
 *
 * Note: Element names match exactly what Kogito expects in XML
 */
export const droolsDescriptor = {
  name: 'Drools',
  prefix: 'drools',
  uri: 'http://www.jboss.org/drools',
  types: [
    {
      // Produces <drools:taskName>Rest</drools:taskName>
      name: 'taskName',
      superClass: ['Element'],
      properties: [
        {
          name: 'body',
          type: 'String',
          isBody: true
        }
      ]
    },
    {
      name: 'metaData',
      superClass: ['Element'],
      properties: [
        {
          name: 'name',
          type: 'String',
          isAttr: true
        },
        {
          name: 'metaValue',
          type: 'metaValue'
        }
      ]
    },
    {
      name: 'metaValue',
      superClass: ['Element'],
      properties: [
        {
          name: 'body',
          type: 'String',
          isBody: true
        }
      ]
    },
    {
      name: 'onEntry',
      superClass: ['Element'],
      properties: [
        {
          name: 'script',
          type: 'script'
        }
      ]
    },
    {
      name: 'onExit',
      superClass: ['Element'],
      properties: [
        {
          name: 'script',
          type: 'script'
        }
      ]
    },
    {
      name: 'script',
      superClass: ['Element'],
      properties: [
        {
          name: 'scriptFormat',
          type: 'String',
          isAttr: true
        },
        {
          name: 'body',
          type: 'String',
          isBody: true
        }
      ]
    },
    {
      name: 'global',
      superClass: ['Element'],
      properties: [
        {
          name: 'identifier',
          type: 'String',
          isAttr: true
        },
        {
          name: 'type',
          type: 'String',
          isAttr: true
        }
      ]
    },
    {
      name: 'import',
      superClass: ['Element'],
      properties: [
        {
          name: 'name',
          type: 'String',
          isAttr: true
        }
      ]
    }
  ],
  enumerations: [],
  associations: []
};

export default droolsDescriptor;
