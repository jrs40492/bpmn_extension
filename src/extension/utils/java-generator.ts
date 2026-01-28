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
 * Kogito extracts the CloudEvents `data` field before passing to Jackson,
 * so we only need the last segment (actual field name).
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
 * Since Kogito extracts the CloudEvents `data` field before passing to Jackson:
 * - $.data.userId -> Jackson receives {"userId": "123"} -> simple field access, NO deserializer
 * - $.userId -> Jackson receives {"userId": "123"} -> simple field access, NO deserializer
 * - $.data.nested.deeply.field -> needs custom deserializer for deep nesting WITHIN data
 *
 * A custom deserializer is only needed for paths with 3+ segments AFTER $.data,
 * i.e., deeply nested structures within the data payload itself.
 */
export function requiresCustomDeserializer(fields: PayloadFieldDefinition[]): boolean {
  return fields.some(field => {
    if (!field.expression) return false;
    const segments = getPathSegments(field.expression);

    // Remove "data" prefix if present (Kogito extracts it)
    const effectiveSegments = segments[0] === 'data' ? segments.slice(1) : segments;

    // Need custom deserializer only for deeply nested paths (2+ levels within data)
    // e.g., $.data.nested.field has effectiveSegments ["nested", "field"] -> needs deserializer
    // e.g., $.data.userId has effectiveSegments ["userId"] -> simple access, no deserializer
    return effectiveSegments.length >= 2;
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
 * Since Kogito extracts the CloudEvents `data` field, we only need JsonPath
 * for deeply nested paths WITHIN the data payload.
 *
 * Examples:
 *   $.data.userId -> Jackson receives {"userId": "123"} -> no JsonPath needed
 *   $.data.nested.deeply.field -> needs JsonPath for nested.deeply.field
 */
export function requiresJsonPathLibrary(fields: PayloadFieldDefinition[]): boolean {
  return fields.some(f => {
    const segments = getPathSegments(f.expression || '');
    // Remove "data" prefix if present (Kogito extracts it)
    const effectiveSegments = segments[0] === 'data' ? segments.slice(1) : segments;
    // Needs JsonPath if path has 2+ effective segments (nested within data)
    return effectiveSegments.length >= 2;
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

      // Remove "data" prefix if present - Kogito extracts CloudEvents data field
      const effectiveSegments = segments[0] === 'data' ? segments.slice(1) : segments;

      // Use field name if no expression provided or only had $.data prefix
      if (effectiveSegments.length === 0) {
        return `        if (root.has("${fieldName}")) {
            payload.set${methodSuffix}(root.get("${fieldName}").${getJsonNodeMethod(javaType)});
        }`;
      }

      // For simple field access (1 segment), use direct access
      // Kogito extracts CloudEvents data, so $.data.userId becomes just checking for "userId"
      if (effectiveSegments.length === 1) {
        const jsonFieldName = effectiveSegments[0];
        return `        if (root.has("${jsonFieldName}")) {
            payload.set${methodSuffix}(root.get("${jsonFieldName}").${getJsonNodeMethod(javaType)});
        }`;
      }

      // For deeply nested paths (2+ effective segments), use JsonPath
      // Build the effective JSONPath for the nested structure within data
      const effectiveJsonPath = '$.' + effectiveSegments.join('.');
      return `        try {
            ${javaType} ${fieldName}Value = JsonPath.read(json, "${effectiveJsonPath}");
            payload.set${methodSuffix}(${fieldName}Value);
        } catch (PathNotFoundException e) {
            // Field not found in payload, leave as null
        }`;
    })
    .join('\n\n');

  const hasDeepPaths = fields.some(f => {
    const segments = getPathSegments(f.expression || '');
    const effectiveSegments = segments[0] === 'data' ? segments.slice(1) : segments;
    return effectiveSegments.length >= 2;
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
 * Kogito extracts CloudEvents data field before deserialization, so we access fields directly.
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
 * Message event configuration for the listener
 */
export interface MessageEventConfig {
  eventId: string;
  messageName: string;
  payloadClassName: string;
  fields: PayloadFieldDefinition[];
}

/**
 * Generate a ProcessEventListener that automatically extracts payload fields
 * and sets them as process variables when message events are triggered.
 * Handles both typed payload classes AND raw Map/JsonNode payloads for flexibility.
 *
 * Note: Kogito extracts the CloudEvents `data` field before passing to us,
 * so we always access fields directly (not through "data" prefix).
 */
export function generatePayloadExtractorListener(
  packageName: string,
  events: MessageEventConfig[]
): string {
  // Generate extraction code for each event
  const eventCases = events.map(event => {
    const fieldSetters = event.fields.map(field => {
      const fieldName = toCamelCase(field.name);
      const getterName = `get${toPascalCase(field.name)}`;

      return `                        variables.put("${fieldName}", typedPayload.${getterName}());`;
    }).join('\n');

    // Build the raw map extraction as fallback
    // Kogito extracts CloudEvents data, so we access fields directly
    const rawMapSetters = event.fields.map(field => {
      const fieldName = toCamelCase(field.name);
      const expression = field.expression || '';

      const pathSegments = expression
        .replace(/^\$\.?/, '')
        .split('.')
        .filter((s: string) => s);

      // Remove "data" prefix if present - Kogito extracts CloudEvents data field
      const effectiveSegments = pathSegments[0] === 'data' ? pathSegments.slice(1) : pathSegments;

      let mapExtraction: string;
      if (effectiveSegments.length === 0) {
        // No expression or only $.data - use field name directly
        mapExtraction = `rawMap.get("${fieldName}")`;
      } else if (effectiveSegments.length === 1) {
        // Simple field access like $.userId or $.data.userId
        mapExtraction = `rawMap.get("${effectiveSegments[0]}")`;
      } else {
        // For nested paths within data like $.data.nested.field
        // Traverse the map starting from the first effective segment
        mapExtraction = 'rawMap';
        for (let i = 0; i < effectiveSegments.length - 1; i++) {
          mapExtraction = `getNestedMap(${mapExtraction}, "${effectiveSegments[i]}")`;
        }
        mapExtraction = `(${mapExtraction} != null ? ${mapExtraction}.get("${effectiveSegments[effectiveSegments.length - 1]}") : null)`;
      }

      return `                        Object ${fieldName}Value = ${mapExtraction};
                        if (${fieldName}Value != null) {
                            variables.put("${fieldName}", ${fieldName}Value);
                        }`;
    }).join('\n');

    return `            if ("${event.eventId}".equals(nodeId)) {
                Object messageData = variables.get("message_${event.eventId}");
                if (messageData != null) {
                    if (messageData instanceof ${event.payloadClassName}) {
                        // Typed payload - BPMN has correct structureRef
                        ${event.payloadClassName} typedPayload = (${event.payloadClassName}) messageData;
${fieldSetters}
                    } else if (messageData instanceof java.util.Map) {
                        // Raw Map payload - extract fields directly
                        // (Kogito extracts CloudEvents data before passing to us)
                        @SuppressWarnings("unchecked")
                        java.util.Map<String, Object> rawMap = (java.util.Map<String, Object>) messageData;
${rawMapSetters}
                    }
                }
            }`;
  }).join(' else ');

  return `package ${packageName};

import jakarta.enterprise.context.ApplicationScoped;
import org.kie.api.event.process.ProcessNodeTriggeredEvent;
import org.kie.api.event.process.ProcessNodeLeftEvent;
import org.kie.api.event.process.ProcessStartedEvent;
import org.kie.api.event.process.ProcessCompletedEvent;
import org.kie.api.event.process.ProcessVariableChangedEvent;
import org.kie.kogito.internal.process.event.DefaultKogitoProcessEventListener;
import org.kie.kogito.internal.process.runtime.KogitoProcessInstance;

import java.util.Map;

/**
 * Auto-generated listener that extracts payload fields from message events
 * and sets them as process variables.
 * Handles both typed payload classes and raw Map payloads.
 * Generated by BAMOE - do not edit manually.
 */
@ApplicationScoped
public class MessagePayloadExtractor extends DefaultKogitoProcessEventListener {

    @Override
    public void afterNodeTriggered(ProcessNodeTriggeredEvent event) {
        String nodeId = event.getNodeInstance().getNodeId().toExternalFormat();

        if (event.getProcessInstance() instanceof KogitoProcessInstance) {
            KogitoProcessInstance kpi = (KogitoProcessInstance) event.getProcessInstance();
            Map<String, Object> variables = kpi.getVariables();

${eventCases}
        }
    }

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
