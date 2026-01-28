/**
 * Java Class Generator Utilities
 * Generates Java data classes for message payloads
 */

/**
 * Payload field definition from BPMN
 */
export interface PayloadFieldDefinition {
  name: string;
  type: string;
  expression?: string;
}

/**
 * Build the full JSONPath expression based on CloudEvents mode
 * @param fieldName - The simple field name (e.g., "userId")
 * @param isCloudEvents - Whether CloudEvents format is enabled
 * @returns The full JSONPath expression (e.g., "$.data.userId" or "$.userId")
 */
export function buildCloudEventsExpression(fieldName: string, isCloudEvents: boolean): string {
  if (!fieldName) return '';
  if (isCloudEvents) {
    return `$.data.${fieldName}`;
  }
  return `$.${fieldName}`;
}

/**
 * Type mapping from BAMOE types to Java types
 */
const TYPE_MAPPING: Record<string, string> = {
  string: 'String',
  number: 'Double',
  boolean: 'Boolean',
  object: 'Object',
  integer: 'Integer',
  long: 'Long',
  float: 'Float',
  double: 'Double'
};

/**
 * Get Java type from BAMOE type
 */
export function getJavaType(bamoeType: string): string {
  return TYPE_MAPPING[bamoeType.toLowerCase()] || 'Object';
}

/**
 * Convert a string to PascalCase for class names
 */
export function toPascalCase(str: string): string {
  return str
    .replace(/[_-](.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, c => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '');
}

/**
 * Convert a string to camelCase for field/method names
 */
export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Parse JSONPath expression to get the property path after $.data
 * e.g., "$.data.user.id" -> "user.id"
 *       "$.data.userId" -> "userId"
 */
export function parseJsonPath(expression: string): string {
  if (!expression) {
    return '';
  }

  // Remove $.data. prefix if present
  const cleaned = expression
    .replace(/^\$\.data\./, '')
    .replace(/^\$\./, '');

  return cleaned;
}

/**
 * Extract the actual field name from a JSONPath expression.
 * Returns the last segment of the path as the field name.
 *
 * Examples:
 *   $.data.userId -> "userId"
 *   $.userId -> "userId"
 *   $.data.nested.deeply.field -> "field" (but this needs special handling)
 */
export function extractFieldNameFromExpression(expression: string, fallbackFieldName: string): string {
  if (!expression) return fallbackFieldName;
  const segments = getPathSegments(expression);
  return segments.length > 0 ? segments[segments.length - 1] : fallbackFieldName;
}

/**
 * Check if any field requires nested JSONPath extraction.
 *
 * Kogito's behavior depends on the messaging configuration:
 * - With CloudEvents binding enabled: Kogito extracts the `data` field before passing to Jackson
 * - With raw message handling: Kogito passes the full CloudEvents envelope
 *
 * To handle both cases robustly, we generate a custom deserializer that detects
 * whether it received the full envelope or extracted data and handles both.
 *
 * A custom deserializer is needed for any path with 2+ segments (e.g., $.data.userId).
 */
export function requiresCustomDeserializer(fields: PayloadFieldDefinition[]): boolean {
  return fields.some(field => {
    if (!field.expression) return false;
    const segments = getPathSegments(field.expression);

    // Need custom deserializer for any nested path (2+ segments)
    // $.data.userId has segments ["data", "userId"] -> needs deserializer
    // $.userId has segments ["userId"] -> no deserializer needed
    return segments.length >= 2;
  });
}

/**
 * Generate a Java payload class
 */
export function generatePayloadClass(
  packageName: string,
  className: string,
  fields: PayloadFieldDefinition[]
): string {
  const needsDeserializer = requiresCustomDeserializer(fields);

  let imports = `package ${packageName};

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.quarkus.runtime.annotations.RegisterForReflection;`;

  if (needsDeserializer) {
    imports += `
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;`;
  }

  let classAnnotations = '';
  if (needsDeserializer) {
    classAnnotations = `@JsonDeserialize(using = ${className}Deserializer.class)\n`;
  }
  classAnnotations += '@JsonIgnoreProperties(ignoreUnknown = true)\n';
  classAnnotations += '@RegisterForReflection';

  const fieldDeclarations = fields
    .map(field => {
      const javaType = getJavaType(field.type);
      const fieldName = toCamelCase(field.name);
      return `    private ${javaType} ${fieldName};`;
    })
    .join('\n');

  const gettersSetters = fields
    .map(field => {
      const javaType = getJavaType(field.type);
      const fieldName = toCamelCase(field.name);
      const methodSuffix = toPascalCase(field.name);

      return `
    public ${javaType} get${methodSuffix}() {
        return ${fieldName};
    }

    public void set${methodSuffix}(${javaType} ${fieldName}) {
        this.${fieldName} = ${fieldName};
    }`;
    })
    .join('\n');

  return `${imports}

/**
 * Auto-generated payload class for CloudEvent message data.
 * Generated by BAMOE - do not edit manually.
 */
${classAnnotations}
public class ${className} {

${fieldDeclarations}

    public ${className}() {
    }
${gettersSetters}
}
`;
}

/**
 * Get the path segments for navigating JSON structure.
 * Returns array of property names to traverse.
 * e.g., "$.data.userId" -> ["data", "userId"]
 *       "$.userId" -> ["userId"]
 */
function getPathSegments(expression: string): string[] {
  if (!expression) return [];
  // Remove leading $. and split by .
  return expression.trim().replace(/^\$\.?/, '').split('.').filter(s => s);
}

/**
 * Check if any field actually requires JsonPath library.
 *
 * Examples:
 *   $.userId -> 1 segment -> no JsonPath needed (simple access)
 *   $.data.userId -> 2 segments -> no JsonPath needed (path traversal)
 *   $.data.nested.field -> 3 segments -> needs JsonPath for deep nesting
 */
export function requiresJsonPathLibrary(fields: PayloadFieldDefinition[]): boolean {
  return fields.some(f => {
    const segments = getPathSegments(f.expression || '');
    // Needs JsonPath if path has 3+ segments (deeply nested)
    return segments.length >= 3;
  });
}

/**
 * Generate code to traverse JSON and extract a value.
 * For paths like $.data.userId, generates: root.path("data").path("userId")
 */
function generateJsonTraversal(segments: string[], javaType: string): string {
  if (segments.length === 0) {
    return 'root';
  }
  // Build path traversal: root.path("data").path("userId")
  const pathCalls = segments.map(s => `path("${s}")`).join('.');
  return `root.${pathCalls}`;
}

export function generateDeserializerClass(
  packageName: string,
  className: string,
  fields: PayloadFieldDefinition[]
): string {
  const fieldExtractions = fields
    .map(field => {
      const javaType = getJavaType(field.type);
      const fieldName = toCamelCase(field.name);
      const methodSuffix = toPascalCase(field.name);
      const expression = field.expression?.trim() || '';
      const segments = getPathSegments(expression);

      // Use field name if no expression provided
      if (segments.length === 0) {
        return `        if (root.has("${fieldName}")) {
            payload.set${methodSuffix}(root.get("${fieldName}").${getJsonNodeMethod(javaType)});
        }`;
      }

      // For simple field access (1 segment like $.userId), use direct access
      if (segments.length === 1) {
        const jsonFieldName = segments[0];
        return `        if (root.has("${jsonFieldName}")) {
            payload.set${methodSuffix}(root.get("${jsonFieldName}").${getJsonNodeMethod(javaType)});
        }`;
      }

      // For 2-segment paths (like $.data.userId), handle both CloudEvents cases:
      // 1. Full CloudEvents envelope (has "specversion" and "data") - navigate full path
      // 2. Data already extracted by Kogito - access directly
      if (segments.length === 2 && segments[0] === 'data') {
        const actualFieldName = segments[1];
        const traversal = segments.map(s => `path("${s}")`).join('.');
        return `        // Handle both full CloudEvents envelope and extracted data
        if (root.has("specversion") && root.has("data")) {
            // Full CloudEvents envelope - navigate full path
            JsonNode ${fieldName}Node = root.${traversal};
            if (${fieldName}Node != null && !${fieldName}Node.isMissingNode()) {
                payload.set${methodSuffix}(${fieldName}Node.${getJsonNodeMethod(javaType)});
            }
        } else if (root.has("${actualFieldName}")) {
            // Data already extracted by Kogito - access directly
            payload.set${methodSuffix}(root.get("${actualFieldName}").${getJsonNodeMethod(javaType)});
        }`;
      }

      // For other 2-segment paths (not $.data.X), use simple traversal
      if (segments.length === 2) {
        const traversal = segments.map(s => `path("${s}")`).join('.');
        return `        JsonNode ${fieldName}Node = root.${traversal};
        if (${fieldName}Node != null && !${fieldName}Node.isMissingNode()) {
            payload.set${methodSuffix}(${fieldName}Node.${getJsonNodeMethod(javaType)});
        }`;
      }

      // For deeply nested paths (3+ segments), use JsonPath
      const fullJsonPath = '$.' + segments.join('.');
      return `        try {
            ${javaType} ${fieldName}Value = JsonPath.read(json, "${fullJsonPath}");
            payload.set${methodSuffix}(${fieldName}Value);
        } catch (PathNotFoundException e) {
            // Field not found in payload, leave as null
        }`;
    })
    .join('\n\n');

  const hasDeepPaths = fields.some(f => {
    const segments = getPathSegments(f.expression || '');
    return segments.length >= 3;
  });

  let imports = `package ${packageName};

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;`;

  if (hasDeepPaths) {
    imports += `
import com.jayway.jsonpath.JsonPath;
import com.jayway.jsonpath.PathNotFoundException;`;
  }

  return `${imports}

/**
 * Custom deserializer for ${className} to handle nested JSONPath expressions.
 * Handles both full CloudEvents envelope and extracted data payloads.
 * Generated by BAMOE - do not edit manually.
 */
public class ${className}Deserializer extends JsonDeserializer<${className}> {

    @Override
    public ${className} deserialize(JsonParser p, DeserializationContext ctx) throws IOException {
        JsonNode root = p.getCodec().readTree(p);
        String json = root.toString();

        ${className} payload = new ${className}();

${fieldExtractions}

        return payload;
    }
}
`;
}

/**
 * Get the appropriate JsonNode getter method for a Java type
 */
function getJsonNodeMethod(javaType: string): string {
  switch (javaType) {
    case 'String':
      return 'asText()';
    case 'Boolean':
      return 'asBoolean()';
    case 'Integer':
    case 'Long':
      return 'asLong()';
    case 'Double':
    case 'Float':
      return 'asDouble()';
    default:
      return 'asText()';
  }
}


/**
 * Generate class name from message name
 */
export function generateClassName(messageName: string): string {
  // Remove common prefixes/suffixes and convert to PascalCase
  let name = messageName
    .replace(/^message[-_]?/i, '')
    .replace(/[-_]?message$/i, '')
    .replace(/[-_]?event$/i, '');

  // If name is empty or just an ID, use the full message name
  if (!name || /^[a-f0-9-]+$/i.test(name)) {
    name = messageName;
  }

  return toPascalCase(name) + 'Payload';
}

/**
 * Type of message event in the BPMN process
 */
export type MessageEventType = 'start' | 'intermediateCatch' | 'boundary' | 'receiveTask';

/**
 * Message event configuration for the listener
 */
export interface MessageEventConfig {
  eventId: string;
  messageName: string;
  payloadClassName: string;
  fields: PayloadFieldDefinition[];
  eventType: MessageEventType;
}

/**
 * Generate extraction code for a single event's fields
 */
function generateFieldExtractionCode(
  event: MessageEventConfig,
  indent: string
): { typedSetters: string; rawMapSetters: string } {
  const fieldSetters = event.fields.map(field => {
    const fieldName = toCamelCase(field.name);
    const getterName = `get${toPascalCase(field.name)}`;
    return `${indent}    variables.put("${fieldName}", typedPayload.${getterName}());`;
  }).join('\n');

  // Build the raw map extraction as fallback
  // Handle both full CloudEvents envelope and extracted data
  const rawMapSetters = event.fields.map(field => {
    const fieldName = toCamelCase(field.name);
    const expression = field.expression || '';

    const pathSegments = expression
      .replace(/^\$\.?/, '')
      .split('.')
      .filter((s: string) => s);

    let mapExtraction: string;
    if (pathSegments.length === 0) {
      // No expression - use field name directly
      mapExtraction = `rawMap.get("${fieldName}")`;
    } else if (pathSegments.length === 1) {
      // Simple field access like $.userId
      mapExtraction = `rawMap.get("${pathSegments[0]}")`;
    } else if (pathSegments.length === 2 && pathSegments[0] === 'data') {
      // For $.data.X paths, handle both CloudEvents envelope and extracted data
      const actualFieldName = pathSegments[1];
      // Check if full CloudEvents envelope (has "specversion" and "data") or extracted data
      mapExtraction = `(rawMap.containsKey("specversion") && rawMap.containsKey("data")
${indent}        ? (getNestedMap(rawMap, "data") != null ? getNestedMap(rawMap, "data").get("${actualFieldName}") : null)
${indent}        : rawMap.get("${actualFieldName}"))`;
    } else {
      // For other nested paths like $.nested.field
      // Traverse the full path as specified
      mapExtraction = 'rawMap';
      for (let i = 0; i < pathSegments.length - 1; i++) {
        mapExtraction = `getNestedMap(${mapExtraction}, "${pathSegments[i]}")`;
      }
      mapExtraction = `(${mapExtraction} != null ? ${mapExtraction}.get("${pathSegments[pathSegments.length - 1]}") : null)`;
    }

    return `${indent}    Object ${fieldName}Value = ${mapExtraction};
${indent}    if (${fieldName}Value != null) {
${indent}        variables.put("${fieldName}", ${fieldName}Value);
${indent}    }`;
  }).join('\n');

  return { typedSetters: fieldSetters, rawMapSetters };
}

/**
 * Generate a ProcessEventListener that automatically extracts payload fields
 * and sets them as process variables when message events are triggered.
 * Handles both typed payload classes AND raw Map/JsonNode payloads for flexibility.
 *
 * IMPORTANT: Uses different event handlers based on event type:
 * - Start events: Uses afterProcessStarted (fires AFTER message data is placed in variables)
 * - Catch events/boundary/receive tasks: Uses afterNodeLeft (fires AFTER node completes and data outputs are processed)
 *
 * This timing is critical because afterNodeTriggered fires BEFORE Kogito processes
 * dataOutputAssociations, so the message variable isn't set yet.
 *
 * Note: Kogito's behavior depends on messaging configuration - it may pass either
 * the full CloudEvents envelope or the extracted data. The generated code handles both.
 */
export function generatePayloadExtractorListener(
  packageName: string,
  events: MessageEventConfig[]
): string {
  // Separate events by type for different handlers
  const startEvents = events.filter(e => e.eventType === 'start');
  const catchEvents = events.filter(e => e.eventType !== 'start');

  // Generate extraction code for start events (used in afterProcessStarted)
  let startEventCases = '';
  if (startEvents.length > 0) {
    startEventCases = startEvents.map(event => {
      const { typedSetters, rawMapSetters } = generateFieldExtractionCode(event, '            ');

      return `        // Extract fields from start event ${event.eventId}
        Object messageData_${event.eventId.replace(/-/g, '_')} = variables.get("message_${event.eventId}");
        if (messageData_${event.eventId.replace(/-/g, '_')} != null) {
            if (messageData_${event.eventId.replace(/-/g, '_')} instanceof ${event.payloadClassName}) {
                // Typed payload - BPMN has correct structureRef
                ${event.payloadClassName} typedPayload = (${event.payloadClassName}) messageData_${event.eventId.replace(/-/g, '_')};
${typedSetters}
            } else if (messageData_${event.eventId.replace(/-/g, '_')} instanceof java.util.Map) {
                // Raw Map payload - navigate structure as specified in expressions
                @SuppressWarnings("unchecked")
                java.util.Map<String, Object> rawMap = (java.util.Map<String, Object>) messageData_${event.eventId.replace(/-/g, '_')};
${rawMapSetters}
            }
        }`;
    }).join('\n\n');
  }

  // Generate extraction code for catch events (used in afterNodeLeft)
  let catchEventCases = '';
  if (catchEvents.length > 0) {
    catchEventCases = catchEvents.map(event => {
      const { typedSetters, rawMapSetters } = generateFieldExtractionCode(event, '                ');

      return `            if ("${event.eventId}".equals(nodeId)) {
                Object messageData = variables.get("message_${event.eventId}");
                if (messageData != null) {
                    if (messageData instanceof ${event.payloadClassName}) {
                        // Typed payload - BPMN has correct structureRef
                        ${event.payloadClassName} typedPayload = (${event.payloadClassName}) messageData;
${typedSetters}
                    } else if (messageData instanceof java.util.Map) {
                        // Raw Map payload - navigate structure as specified in expressions
                        @SuppressWarnings("unchecked")
                        java.util.Map<String, Object> rawMap = (java.util.Map<String, Object>) messageData;
${rawMapSetters}
                    }
                }
            }`;
    }).join(' else ');
  }

  // Build the afterProcessStarted method if there are start events
  let afterProcessStartedMethod = '';
  if (startEvents.length > 0) {
    afterProcessStartedMethod = `
    /**
     * Handle MESSAGE START EVENTS.
     * This fires AFTER the process instance is fully initialized and message data
     * has been deserialized and placed in variables.
     */
    @Override
    public void afterProcessStarted(ProcessStartedEvent event) {
        if (event.getProcessInstance() instanceof KogitoProcessInstance) {
            KogitoProcessInstance kpi = (KogitoProcessInstance) event.getProcessInstance();
            Map<String, Object> variables = kpi.getVariables();

${startEventCases}
        }
    }
`;
  }

  // Build the afterNodeLeft method if there are catch events
  let afterNodeLeftMethod = '';
  if (catchEvents.length > 0) {
    afterNodeLeftMethod = `
    /**
     * Handle INTERMEDIATE CATCH EVENTS, BOUNDARY EVENTS, and RECEIVE TASKS.
     * This fires AFTER the node completes and dataOutputAssociations are processed,
     * so the message variable is available.
     */
    @Override
    public void afterNodeLeft(ProcessNodeLeftEvent event) {
        String nodeId = event.getNodeInstance().getNodeId().toExternalFormat();

        if (event.getProcessInstance() instanceof KogitoProcessInstance) {
            KogitoProcessInstance kpi = (KogitoProcessInstance) event.getProcessInstance();
            Map<String, Object> variables = kpi.getVariables();

${catchEventCases}
        }
    }
`;
  }

  return `package ${packageName};

import jakarta.enterprise.context.ApplicationScoped;
import org.kie.api.event.process.ProcessNodeLeftEvent;
import org.kie.api.event.process.ProcessStartedEvent;
import org.kie.kogito.internal.process.event.DefaultKogitoProcessEventListener;
import org.kie.kogito.internal.process.runtime.KogitoProcessInstance;

import java.util.Map;

/**
 * Auto-generated listener that extracts payload fields from message events
 * and sets them as process variables.
 *
 * Uses appropriate event handlers based on event type:
 * - Start events: afterProcessStarted (fires after process initialization when variables are available)
 * - Catch/boundary events: afterNodeLeft (fires after node completes and data outputs are processed)
 *
 * Handles both typed payload classes and raw Map payloads.
 * Generated by BAMOE - do not edit manually.
 */
@ApplicationScoped
public class MessagePayloadExtractor extends DefaultKogitoProcessEventListener {
${afterProcessStartedMethod}${afterNodeLeftMethod}
    /**
     * Safely get a nested map from a parent map
     */
    @SuppressWarnings("unchecked")
    private static java.util.Map<String, Object> getNestedMap(Object parent, String key) {
        if (parent instanceof java.util.Map) {
            Object value = ((java.util.Map<String, Object>) parent).get(key);
            if (value instanceof java.util.Map) {
                return (java.util.Map<String, Object>) value;
            }
        }
        return null;
    }
}
`;
}
