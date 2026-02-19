/**
 * User Task Form Generator
 * Generates self-contained HTML forms and config JSON for jBPM/Kogito user tasks.
 * Supports dot-notation field names for nested object grouping.
 * Pure functions — no VS Code API dependency.
 */

export interface FormField {
  name: string;
  dtype: string;
  variable?: string;
  defaultValue?: string;
}

interface HtmlInputInfo {
  type: string;
  step?: string;
  inputTag: 'input' | 'textarea';
}

/**
 * Grouped field structure for dot-notation support.
 * Fields like pull_request.author, pull_request.title get grouped under prefix "pull_request".
 */
interface FieldGroup {
  prefix: string;
  fields: Array<{ subName: string; fullName: string; dtype: string; defaultValue?: string }>;
}

/**
 * Map a drools:dtype (or itemSubjectRef) to an HTML input type.
 */
export function getHtmlInputType(dtype: string): HtmlInputInfo {
  const normalized = dtype.replace(/^java\.lang\./, '').toLowerCase();

  switch (normalized) {
    case 'string':
      return { type: 'text', inputTag: 'input' };
    case 'boolean':
      return { type: 'checkbox', inputTag: 'input' };
    case 'integer':
    case 'int':
    case 'long':
      return { type: 'number', step: '1', inputTag: 'input' };
    case 'double':
    case 'float':
    case 'number':
      return { type: 'number', step: 'any', inputTag: 'input' };
    default:
      // Complex object types (e.g. com.example.PullRequest) → textarea for JSON
      return { type: 'text', inputTag: 'textarea' };
  }
}

/**
 * Convert a camelCase or PascalCase field name to a human-readable label.
 * e.g. "pullRequest" → "Pull Request", "approved" → "Approved"
 */
function toLabel(name: string): string {
  // Insert space before uppercase letters, then capitalize first letter
  const spaced = name
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Convert a snake_case or camelCase name to PascalCase.
 * e.g. "pull_request" → "PullRequest"
 */
function toPascalCase(name: string): string {
  return name
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Check if a string is a valid JavaScript identifier.
 */
function isValidJsIdentifier(name: string): boolean {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name);
}

/**
 * Build a JS property access expression for a given object and property name.
 * Uses dot notation for valid identifiers, bracket notation otherwise.
 */
function propAccess(obj: string, prop: string): string {
  if (isValidJsIdentifier(prop)) {
    return `${obj}.${prop}`;
  }
  return `${obj}["${prop.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
}

/**
 * Build a JS optional chaining property access expression.
 * Uses ?.prop for valid identifiers, ?.["prop"] otherwise.
 */
function optionalPropAccess(prop: string): string {
  if (isValidJsIdentifier(prop)) {
    return `?.${prop}`;
  }
  return `?.["${prop.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Group fields by dot-notation prefix.
 * Fields without dots are returned as flat (no group).
 * Fields with dots are grouped by first segment.
 */
function groupFields(fields: FormField[]): { flat: FormField[]; groups: FieldGroup[] } {
  const flat: FormField[] = [];
  const groupMap = new Map<string, FieldGroup>();

  for (const field of fields) {
    const dotIdx = field.name.indexOf('.');
    if (dotIdx === -1) {
      flat.push(field);
    } else {
      const prefix = field.name.substring(0, dotIdx);
      const subName = field.name.substring(dotIdx + 1);
      let group = groupMap.get(prefix);
      if (!group) {
        group = { prefix, fields: [] };
        groupMap.set(prefix, group);
      }
      group.fields.push({ subName, fullName: field.name, dtype: field.dtype, defaultValue: field.defaultValue });
    }
  }

  return { flat, groups: Array.from(groupMap.values()) };
}

/**
 * Render a single form field as HTML.
 */
function renderField(field: FormField, readonly: boolean): string {
  const info = getHtmlInputType(field.dtype);
  const label = toLabel(field.name.includes('.') ? field.name.split('.').pop()! : field.name);
  const id = field.name;
  const readonlyAttr = readonly ? ' readonly' : '';
  const disabledAttr = readonly && info.type === 'checkbox' ? ' disabled' : '';
  const defaultVal = field.defaultValue;

  if (info.inputTag === 'textarea') {
    const textareaContent = defaultVal ? escapeHtml(defaultVal) : '';
    return `      <div class="form-field">
        <label for="${escapeHtml(id)}">${escapeHtml(label)}</label>
        <textarea id="${escapeHtml(id)}" name="${escapeHtml(id)}" rows="4"${readonlyAttr}>${textareaContent}</textarea>
      </div>`;
  }

  if (info.type === 'checkbox') {
    const checkedAttr = defaultVal === 'true' ? ' checked' : '';
    return `      <div class="form-field checkbox-field">
        <label>
          <input type="checkbox" id="${escapeHtml(id)}" name="${escapeHtml(id)}"${checkedAttr}${disabledAttr} />
          ${escapeHtml(label)}
        </label>
      </div>`;
  }

  const stepAttr = info.step ? ` step="${info.step}"` : '';
  const valueAttr = defaultVal ? ` value="${escapeHtml(defaultVal)}"` : '';
  return `      <div class="form-field">
        <label for="${escapeHtml(id)}">${escapeHtml(label)}</label>
        <input type="${info.type}" id="${escapeHtml(id)}" name="${escapeHtml(id)}"${stepAttr}${valueAttr}${readonlyAttr} />
      </div>`;
}

/**
 * Render a group of dot-notation fields inside a fieldset.
 */
function renderFieldGroup(group: FieldGroup, readonly: boolean): string {
  const legend = toLabel(group.prefix);
  const fieldHtml = group.fields.map(f =>
    renderField({ name: f.fullName, dtype: f.dtype, defaultValue: f.defaultValue }, readonly)
  ).join('\n');

  return `      <fieldset class="nested-fieldset">
        <legend>${escapeHtml(legend)}</legend>
${fieldHtml}
      </fieldset>`;
}

/**
 * Render fields for a section (inputs or outputs), grouping dot-notation fields.
 */
function renderSectionFields(fields: FormField[], readonly: boolean): string {
  const { flat, groups } = groupFields(fields);
  const parts: string[] = [];

  // Render groups first (in order they appear)
  for (const group of groups) {
    parts.push(renderFieldGroup(group, readonly));
  }

  // Render flat fields
  for (const field of flat) {
    parts.push(renderField(field, readonly));
  }

  return parts.join('\n');
}

/**
 * Generate a self-contained HTML form for a user task.
 */
export function generateFormHtml(
  taskName: string,
  inputs: FormField[],
  outputs: FormField[]
): string {
  const inputFields = renderSectionFields(inputs, true);
  const outputFields = renderSectionFields(outputs, false);

  const inputFieldset = inputs.length > 0
    ? `    <fieldset>
      <legend>Inputs</legend>
${inputFields}
    </fieldset>`
    : '';

  const outputFieldset = outputs.length > 0
    ? `    <fieldset>
      <legend>Outputs</legend>
${outputFields}
    </fieldset>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(taskName)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #333; background: #fafafa; }
    h2 { margin-bottom: 20px; font-size: 1.4em; }
    fieldset { border: 1px solid #ddd; border-radius: 6px; padding: 16px 20px; margin-bottom: 20px; background: #fff; }
    legend { font-weight: 600; padding: 0 8px; font-size: 1.1em; }
    .nested-fieldset { border: 1px solid #e8e8e8; border-radius: 4px; padding: 12px 16px; margin-bottom: 14px; background: #fafafa; }
    .nested-fieldset legend { font-size: 0.95em; color: #555; }
    .form-field { margin-bottom: 14px; }
    .form-field label { display: block; margin-bottom: 4px; font-weight: 500; font-size: 0.9em; }
    .form-field input[type="text"],
    .form-field input[type="number"],
    .form-field textarea { width: 100%; padding: 8px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.95em; font-family: inherit; }
    .form-field input[readonly],
    .form-field textarea[readonly] { background: #f0f0f0; color: #666; }
    .checkbox-field label { display: flex; align-items: center; gap: 8px; font-weight: 500; font-size: 0.9em; cursor: pointer; }
    .checkbox-field input[type="checkbox"] { width: 18px; height: 18px; }
  </style>
</head>
<body>
  <h2>${escapeHtml(taskName)}</h2>
  <form id="taskForm">
${inputFieldset}
${outputFieldset}
  </form>
  <script>
    /* Kogito form lifecycle integration */
    function setFormData(data) {
      if (!data) return;
${generateSetFormDataBody([...inputs, ...outputs])}
    }

    function getFormData() {
      var formData = {};
${generateGetFormDataBody([...inputs, ...outputs])}
      return formData;
    }

    function validateForm() {
      /* Add custom validation logic here */
    }

    var formApi = window.Form.openForm({
      onOpen: function(data, context) {
        setFormData(data);
      }
    });
    formApi.beforeSubmit = function() { validateForm(); };
    formApi.afterSubmit = function(response) {};
    formApi.getFormData = function() { return getFormData(); };
  </script>
</body>
</html>`;
}

/**
 * Generate the setFormData function body, handling nested paths.
 */
/**
 * Build the data accessor expression for a field.
 * If a variable binding is set, reads from that variable path.
 * Otherwise reads from the field name path.
 */
function buildDataAccessor(field: FormField): string {
  if (field.variable) {
    // Variable binding: read from data?.{variable}
    return `data${optionalPropAccess(field.variable)}`;
  }

  if (field.name.includes('.')) {
    // Nested path without variable: data?.pull_request?.author
    const dataPath = field.name.split('.').map(p => optionalPropAccess(p)).join('');
    return `data${dataPath}`;
  }

  // Flat path
  return propAccess('data', field.name);
}

/**
 * Build a default value literal for use in generated JS.
 */
function buildDefaultLiteral(field: FormField): string | undefined {
  if (field.defaultValue === undefined || field.defaultValue === '') return undefined;
  const info = getHtmlInputType(field.dtype);
  if (info.type === 'checkbox') {
    return field.defaultValue === 'true' ? 'true' : 'false';
  }
  if (info.type === 'number') {
    return field.defaultValue;
  }
  // String-like: wrap in quotes
  return `"${field.defaultValue.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function generateSetFormDataBody(fields: FormField[]): string {
  const lines: string[] = [];

  for (const field of fields) {
    const info = getHtmlInputType(field.dtype);
    const id = field.name;
    const accessor = buildDataAccessor(field);
    const defaultLit = buildDefaultLiteral(field);

    if (info.type === 'checkbox') {
      if (defaultLit !== undefined) {
        lines.push(`      document.getElementById("${id}").checked = ${accessor} !== undefined ? !!${accessor} : ${defaultLit};`);
      } else {
        lines.push(`      if (${accessor} !== undefined) document.getElementById("${id}").checked = !!${accessor};`);
      }
    } else if (info.inputTag === 'textarea') {
      if (defaultLit !== undefined) {
        lines.push(`      document.getElementById("${id}").value = ${accessor} !== undefined ? (typeof ${accessor} === "object" ? JSON.stringify(${accessor}, null, 2) : (${accessor} ?? "")) : ${defaultLit};`);
      } else {
        lines.push(`      if (${accessor} !== undefined) document.getElementById("${id}").value = typeof ${accessor} === "object" ? JSON.stringify(${accessor}, null, 2) : (${accessor} ?? "");`);
      }
    } else {
      if (defaultLit !== undefined) {
        lines.push(`      document.getElementById("${id}").value = ${accessor} ?? ${defaultLit};`);
      } else {
        lines.push(`      if (${accessor} !== undefined) document.getElementById("${id}").value = ${accessor} ?? "";`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Generate the getFormData function body, handling nested paths.
 */
function generateGetFormDataBody(fields: FormField[]): string {
  const lines: string[] = [];
  const initializedPrefixes = new Set<string>();

  for (const field of fields) {
    const info = getHtmlInputType(field.dtype);
    const id = field.name;

    if (field.name.includes('.')) {
      // Ensure parent object is initialized
      const parts = field.name.split('.');
      const prefix = parts[0];
      if (!initializedPrefixes.has(prefix)) {
        const prefixAccess = propAccess('formData', prefix);
        lines.push(`      ${prefixAccess} = ${prefixAccess} || {};`);
        initializedPrefixes.add(prefix);
      }

      // Build nested assignment path: formData.pull_request.author = ...
      // or formData["some name"]["sub field"] = ...
      let assignPath = 'formData';
      for (const part of parts) {
        assignPath = propAccess(assignPath, part);
      }

      if (info.type === 'checkbox') {
        lines.push(`      ${assignPath} = document.getElementById("${id}").checked;`);
      } else if (info.inputTag === 'textarea') {
        lines.push(`      try { ${assignPath} = JSON.parse(document.getElementById("${id}").value); } catch(e) { ${assignPath} = document.getElementById("${id}").value; }`);
      } else if (info.type === 'number') {
        lines.push(`      ${assignPath} = Number(document.getElementById("${id}").value);`);
      } else {
        lines.push(`      ${assignPath} = document.getElementById("${id}").value;`);
      }
    } else {
      // Flat path
      const flatAccess = propAccess('formData', id);
      if (info.type === 'checkbox') {
        lines.push(`      ${flatAccess} = document.getElementById("${id}").checked;`);
      } else if (info.inputTag === 'textarea') {
        lines.push(`      try { ${flatAccess} = JSON.parse(document.getElementById("${id}").value); } catch(e) { ${flatAccess} = document.getElementById("${id}").value; }`);
      } else if (info.type === 'number') {
        lines.push(`      ${flatAccess} = Number(document.getElementById("${id}").value);`);
      } else {
        lines.push(`      ${flatAccess} = document.getElementById("${id}").value;`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Map a dtype to a JSON Schema type string.
 */
function dtypeToJsonSchemaType(dtype: string): string {
  const normalized = dtype.replace(/^java\.lang\./, '').toLowerCase();
  switch (normalized) {
    case 'string':
      return 'string';
    case 'boolean':
      return 'boolean';
    case 'integer':
    case 'int':
    case 'long':
      return 'integer';
    case 'double':
    case 'float':
    case 'number':
      return 'number';
    default:
      return 'object';
  }
}

/**
 * Generate the JSON config (schema + no external resources) for a user task form.
 * Supports dot-notation fields by generating $defs for grouped types.
 */
export function generateFormConfig(
  inputs: FormField[],
  outputs: FormField[]
): string {
  const allFields = [...inputs, ...outputs];
  const { flat, groups } = groupFields(allFields);

  const properties: Record<string, unknown> = {};
  const $defs: Record<string, unknown> = {};

  // Add grouped fields as $defs references
  for (const group of groups) {
    const defName = toPascalCase(group.prefix);
    const defProperties: Record<string, { type: string }> = {};
    for (const f of group.fields) {
      defProperties[f.subName] = { type: dtypeToJsonSchemaType(f.dtype) };
    }
    $defs[defName] = {
      type: 'object',
      properties: defProperties
    };
    properties[group.prefix] = { $ref: `#/$defs/${defName}` };
  }

  // Add flat fields
  for (const field of flat) {
    properties[field.name] = { type: dtypeToJsonSchemaType(field.dtype) };
  }

  const schema: Record<string, unknown> = {
    $schema: 'https://json-schema.org/draft/2019-09/schema',
    type: 'object',
    properties
  };

  // Only add $defs if there are grouped fields
  if (Object.keys($defs).length > 0) {
    schema.$defs = $defs;
  }

  const config = {
    schema: JSON.stringify(schema),
    resources: {}
  };

  return JSON.stringify(config, null, 2) + '\n';
}
