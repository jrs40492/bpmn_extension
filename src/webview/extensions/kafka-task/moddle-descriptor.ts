/**
 * Moddle descriptor for Kafka Task extension
 * Defines custom properties that can be stored in BPMN XML
 */
export const kafkaTaskDescriptor = {
  name: 'Kafka',
  prefix: 'kafka',
  uri: 'http://bamoe.io/schema/kafka',
  xml: {
    tagAlias: 'lowerCase'
  },
  types: [
    {
      name: 'KafkaTaskConfig',
      superClass: ['Element'],
      properties: [
        {
          name: 'topic',
          type: 'String',
          isAttr: true
        },
        {
          name: 'bootstrapServers',
          type: 'String',
          isAttr: true,
          default: 'localhost:9092'
        },
        {
          name: 'operation',
          type: 'String',
          isAttr: true,
          default: 'publish'
        },
        {
          name: 'keyExpression',
          type: 'String',
          isAttr: true
        },
        {
          name: 'messageExpression',
          type: 'String',
          isAttr: true
        },
        {
          name: 'groupId',
          type: 'String',
          isAttr: true
        },
        {
          name: 'headers',
          type: 'String',
          isAttr: true
        },
        {
          name: 'acks',
          type: 'String',
          isAttr: true,
          default: 'all'
        },
        {
          name: 'retries',
          type: 'Integer',
          isAttr: true,
          default: 3
        },
        {
          name: 'timeout',
          type: 'Integer',
          isAttr: true,
          default: 30000
        },
        {
          name: 'autoOffsetReset',
          type: 'String',
          isAttr: true,
          default: 'earliest'
        },
        {
          name: 'responseVariable',
          type: 'String',
          isAttr: true,
          default: 'kafkaResponse'
        }
      ]
    }
  ],
  emumerations: [],
  associations: []
};

export default kafkaTaskDescriptor;
