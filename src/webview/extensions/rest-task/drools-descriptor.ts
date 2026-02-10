/**
 * Moddle descriptor for Drools/Kogito extension elements
 * Required for Kogito runtime compatibility
 *
 * Note: Element names match exactly what Kogito expects in XML
 * The taskName is defined as an extension attribute on bpmn:Task elements
 */
export const droolsDescriptor = {
  name: 'Drools',
  prefix: 'drools',
  uri: 'http://www.jboss.org/drools',
  xml: {
    tagAlias: 'lowerCase'
  },
  types: [
    {
      // Extends bpmn:Task to add drools:taskName attribute
      name: 'TaskExtension',
      isAbstract: true,
      extends: ['bpmn:Task'],
      properties: [
        {
          name: 'taskName',
          type: 'String',
          isAttr: true
        }
      ]
    },
    {
      // Extends bpmn:ServiceTask to add drools:serviceimplementation, serviceinterface, serviceoperation
      name: 'ServiceTaskExtension',
      isAbstract: true,
      extends: ['bpmn:ServiceTask'],
      properties: [
        {
          name: 'serviceimplementation',
          type: 'String',
          isAttr: true
        },
        {
          name: 'serviceinterface',
          type: 'String',
          isAttr: true
        },
        {
          name: 'serviceoperation',
          type: 'String',
          isAttr: true
        }
      ]
    },
    {
      // Extends bpmn:DataInput to add drools:dtype attribute (required by Kogito/BAMOE)
      name: 'DataInputExtension',
      isAbstract: true,
      extends: ['bpmn:DataInput'],
      properties: [
        {
          name: 'dtype',
          type: 'String',
          isAttr: true
        }
      ]
    },
    {
      // Extends bpmn:DataOutput to add drools:dtype attribute (required by Kogito/BAMOE)
      name: 'DataOutputExtension',
      isAbstract: true,
      extends: ['bpmn:DataOutput'],
      properties: [
        {
          name: 'dtype',
          type: 'String',
          isAttr: true
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
