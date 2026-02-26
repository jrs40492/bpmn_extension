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
  fieldKind?: 'flat' | 'object' | 'array';
  arrayItemFields?: Array<{ name: string; dtype: string; defaultValue?: string }>;
  objectFields?: FormField[];
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
interface GroupedField {
  subName: string;
  fullName: string;
  dtype: string;
  defaultValue?: string;
  fieldKind?: 'flat' | 'object' | 'array';
  arrayItemFields?: Array<{ name: string; dtype: string; defaultValue?: string }>;
  objectFields?: FormField[];
}

interface FieldGroup {
  prefix: string;
  fields: GroupedField[];
}

/**
 * Map a drools:dtype (or itemSubjectRef) to an HTML input type.
 */
export function getHtmlInputType(dtype: string): HtmlInputInfo {
  const normalized = dtype.replace(/^java\.(lang|util|time)\./, '').toLowerCase();

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
    case 'date':
    case 'localdate':
      return { type: 'date', inputTag: 'input' };
    case 'localdatetime':
      return { type: 'datetime-local', inputTag: 'input' };
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
      group.fields.push({
        subName,
        fullName: field.name,
        dtype: field.dtype,
        defaultValue: field.defaultValue,
        fieldKind: field.fieldKind,
        arrayItemFields: field.arrayItemFields,
        objectFields: field.objectFields
      });
    }
  }

  return { flat, groups: Array.from(groupMap.values()) };
}

/**
 * Render an expanded object field as a fieldset with sub-fields.
 */
function renderExpandedObject(field: FormField, readonly: boolean, parentPrefix?: string): string {
  const legend = toLabel(field.name);
  const prefix = parentPrefix ? `${parentPrefix}.${field.name}` : field.name;
  const subFields = (field.objectFields || []).map(sub => {
    const subField: FormField = {
      ...sub,
      name: `${prefix}.${sub.name}`
    };
    return renderField(subField, readonly);
  }).join('\n');

  return `      <fieldset class="nested-fieldset">
        <legend>${escapeHtml(legend)}</legend>
${subFields}
      </fieldset>`;
}

/**
 * Render a single sub-field input inside an array card template.
 * Uses data-field attributes instead of id/name for template cloning.
 */
function renderCardInput(itemField: { name: string; dtype: string; defaultValue?: string }, readonly: boolean): string {
  const info = getHtmlInputType(itemField.dtype);
  const label = toLabel(itemField.name);
  const readonlyAttr = readonly ? ' readonly' : '';
  const disabledAttr = readonly && info.type === 'checkbox' ? ' disabled' : '';

  if (info.type === 'checkbox') {
    return `          <div class="form-field checkbox-field">
            <label>
              <input type="checkbox" data-field="${escapeHtml(itemField.name)}"${disabledAttr} />
              ${escapeHtml(label)}
            </label>
          </div>`;
  }

  const stepAttr = info.step ? ` step="${info.step}"` : '';
  return `          <div class="form-field">
            <label>${escapeHtml(label)}</label>
            <input type="${info.type}" data-field="${escapeHtml(itemField.name)}"${stepAttr}${readonlyAttr} />
          </div>`;
}

/**
 * Render an array card list with a template, default items, and add/remove buttons.
 */
function renderArrayCardList(field: FormField, readonly: boolean, parentPrefix?: string): string {
  const itemFields = field.arrayItemFields || [];
  const fullName = parentPrefix ? `${parentPrefix}.${field.name}` : field.name;
  const containerId = `array-${fullName}`;
  const templateId = `template-${fullName}`;
  const label = toLabel(field.name);

  // Build template card HTML
  const templateInputs = itemFields.map(f => renderCardInput(f, readonly)).join('\n');
  const removeBtn = readonly ? '' : `\n          <button type="button" class="card-remove-btn" onclick="this.closest('.array-card').remove(); renumberCards('${escapeHtml(containerId)}')">&times;</button>`;

  const templateHtml = `      <template id="${escapeHtml(templateId)}">
        <div class="array-card">
          <div class="card-header">
            <span class="card-index">#1</span>${removeBtn}
          </div>
${templateInputs}
        </div>
      </template>`;

  // Build default item cards
  let defaultItems: unknown[] = [];
  if (field.defaultValue) {
    try {
      const parsed = JSON.parse(field.defaultValue);
      if (Array.isArray(parsed)) defaultItems = parsed;
    } catch {
      // ignore
    }
  }

  const defaultCards = defaultItems.map((item, idx) => {
    const obj = (item && typeof item === 'object' && !Array.isArray(item)) ? item as Record<string, unknown> : {};
    const cardInputs = itemFields.map(f => {
      const val = obj[f.name];
      const info = getHtmlInputType(f.dtype);
      const readonlyAttr = readonly ? ' readonly' : '';
      const disabledAttr = readonly && info.type === 'checkbox' ? ' disabled' : '';

      if (info.type === 'checkbox') {
        const checked = val ? ' checked' : '';
        return `          <div class="form-field checkbox-field">
            <label>
              <input type="checkbox" data-field="${escapeHtml(f.name)}"${checked}${disabledAttr} />
              ${escapeHtml(toLabel(f.name))}
            </label>
          </div>`;
      }

      const stepAttr = info.step ? ` step="${info.step}"` : '';
      const valueAttr = val !== undefined && val !== null ? ` value="${escapeHtml(String(val))}"` : '';
      return `          <div class="form-field">
            <label>${escapeHtml(toLabel(f.name))}</label>
            <input type="${info.type}" data-field="${escapeHtml(f.name)}"${stepAttr}${valueAttr}${readonlyAttr} />
          </div>`;
    }).join('\n');

    const cardRemoveBtn = readonly ? '' : `\n          <button type="button" class="card-remove-btn" onclick="this.closest('.array-card').remove(); renumberCards('${escapeHtml(containerId)}')">&times;</button>`;

    return `        <div class="array-card">
          <div class="card-header">
            <span class="card-index">#${idx + 1}</span>${cardRemoveBtn}
          </div>
${cardInputs}
        </div>`;
  }).join('\n');

  const addBtn = readonly ? '' : `\n      <button type="button" class="array-add-btn" onclick="addArrayCard('${escapeHtml(containerId)}', '${escapeHtml(templateId)}')">+ Add Item</button>`;

  return `      <fieldset class="nested-fieldset">
        <legend>${escapeHtml(label)}</legend>
${templateHtml}
        <div class="array-list-container" id="${escapeHtml(containerId)}">
${defaultCards}
        </div>${addBtn}
      </fieldset>`;
}

/**
 * Render a single form field as HTML.
 */
function renderField(field: FormField, readonly: boolean, parentPrefix?: string): string {
  // Dispatch expanded object/array fields
  if (field.fieldKind === 'object' && field.objectFields) {
    return renderExpandedObject(field, readonly, parentPrefix);
  }
  if (field.fieldKind === 'array' && field.arrayItemFields) {
    return renderArrayCardList(field, readonly, parentPrefix);
  }

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
    renderField({
      name: f.fullName,
      dtype: f.dtype,
      defaultValue: f.defaultValue,
      fieldKind: f.fieldKind,
      arrayItemFields: f.arrayItemFields,
      objectFields: f.objectFields
    }, readonly)
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
    .form-field input[type="date"],
    .form-field input[type="datetime-local"],
    .form-field textarea { width: 100%; padding: 8px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.95em; font-family: inherit; }
    .form-field input[readonly],
    .form-field textarea[readonly] { background: #f0f0f0; color: #666; }
    .checkbox-field label { display: flex; align-items: center; gap: 8px; font-weight: 500; font-size: 0.9em; cursor: pointer; }
    .checkbox-field input[type="checkbox"] { width: 18px; height: 18px; }
    .array-list-container { display: flex; flex-direction: column; gap: 10px; }
    .array-card { border: 1px solid #ddd; border-radius: 4px; padding: 12px; background: #fff; }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .card-index { font-weight: 600; font-size: 0.85em; color: #666; }
    .card-remove-btn { background: none; border: 1px solid #ddd; border-radius: 3px; color: #999; cursor: pointer; font-size: 1.1em; line-height: 1; padding: 2px 6px; }
    .card-remove-btn:hover { color: #c00; border-color: #c00; }
    .array-add-btn { margin-top: 8px; padding: 6px 14px; background: #f0f0f0; border: 1px dashed #ccc; border-radius: 4px; cursor: pointer; font-size: 0.9em; color: #555; }
    .array-add-btn:hover { background: #e8e8e8; border-color: #aaa; }
  </style>
</head>
<body>
  <h2>${escapeHtml(taskName)}</h2>
  <form id="taskForm">
${inputFieldset}
${outputFieldset}
  </form>
  <script>
    /* Array card utility functions */
    function addArrayCard(containerId, templateId) {
      var container = document.getElementById(containerId);
      var template = document.getElementById(templateId);
      if (!container || !template) return;
      var clone = template.content.cloneNode(true);
      container.appendChild(clone);
      renumberCards(containerId);
    }

    function renumberCards(containerId) {
      var container = document.getElementById(containerId);
      if (!container) return;
      var cards = container.querySelectorAll('.array-card');
      for (var i = 0; i < cards.length; i++) {
        var idx = cards[i].querySelector('.card-index');
        if (idx) idx.textContent = '#' + (i + 1);
      }
    }

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
    // If name has dot-notation and starts with the variable name, strip the prefix
    // and append remaining path segments. e.g. variable="pull_request", name="pull_request.author"
    // → data?.pull_request?.author
    if (field.name.includes('.') && field.name.startsWith(field.variable + '.')) {
      const remaining = field.name.substring(field.variable.length + 1);
      const remainingPath = remaining.split('.').map(p => optionalPropAccess(p)).join('');
      return `data${optionalPropAccess(field.variable)}${remainingPath}`;
    }
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

/**
 * Generate set-data JS for array fields, populating cards from data.
 */
function generateSetArrayField(field: FormField, accessor: string, indent: string): string[] {
  const lines: string[] = [];
  const fullName = field.name;
  const containerId = `array-${fullName}`;
  const templateId = `template-${fullName}`;
  const itemFields = field.arrayItemFields || [];

  lines.push(`${indent}(function() {`);
  lines.push(`${indent}  var arr = ${accessor};`);
  lines.push(`${indent}  if (!Array.isArray(arr)) return;`);
  lines.push(`${indent}  var container = document.getElementById("${containerId}");`);
  lines.push(`${indent}  var template = document.getElementById("${templateId}");`);
  lines.push(`${indent}  if (!container || !template) return;`);
  lines.push(`${indent}  container.innerHTML = "";`);
  lines.push(`${indent}  for (var i = 0; i < arr.length; i++) {`);
  lines.push(`${indent}    var clone = template.content.cloneNode(true);`);
  lines.push(`${indent}    var card = clone.querySelector(".array-card");`);
  lines.push(`${indent}    var item = arr[i] || {};`);
  for (const sub of itemFields) {
    const info = getHtmlInputType(sub.dtype);
    if (info.type === 'checkbox') {
      lines.push(`${indent}    var cb = card.querySelector('[data-field="${sub.name}"]'); if (cb) cb.checked = !!item["${sub.name}"];`);
    } else {
      lines.push(`${indent}    var inp = card.querySelector('[data-field="${sub.name}"]'); if (inp) inp.value = item["${sub.name}"] != null ? item["${sub.name}"] : "";`);
    }
  }
  lines.push(`${indent}    container.appendChild(clone);`);
  lines.push(`${indent}  }`);
  lines.push(`${indent}  renumberCards("${containerId}");`);
  lines.push(`${indent}})();`);
  return lines;
}

/**
 * Generate set-data JS for expanded object fields, recursing into sub-fields.
 */
function generateSetObjectField(field: FormField, accessor: string, indent: string): string[] {
  const lines: string[] = [];
  const objectFields = field.objectFields || [];
  lines.push(`${indent}if (${accessor} !== undefined && ${accessor} !== null) {`);
  for (const sub of objectFields) {
    const subAccessor = `${accessor}["${sub.name}"]`;
    if (sub.fieldKind === 'array' && sub.arrayItemFields) {
      const subWithFullName: FormField = { ...sub, name: `${field.name}.${sub.name}` };
      lines.push(...generateSetArrayField(subWithFullName, subAccessor, `${indent}  `));
    } else if (sub.fieldKind === 'object' && sub.objectFields) {
      const subWithFullName: FormField = { ...sub, name: `${field.name}.${sub.name}` };
      lines.push(...generateSetObjectField(subWithFullName, subAccessor, `${indent}  `));
    } else {
      const subId = `${field.name}.${sub.name}`;
      const info = getHtmlInputType(sub.dtype);
      if (info.type === 'checkbox') {
        lines.push(`${indent}  if (${subAccessor} !== undefined) document.getElementById("${subId}").checked = !!${subAccessor};`);
      } else {
        lines.push(`${indent}  if (${subAccessor} !== undefined) document.getElementById("${subId}").value = ${subAccessor} ?? "";`);
      }
    }
  }
  lines.push(`${indent}}`);
  return lines;
}

function generateSetFormDataBody(fields: FormField[]): string {
  const lines: string[] = [];

  for (const field of fields) {
    const accessor = buildDataAccessor(field);

    // Handle expanded object/array fieldKinds
    if (field.fieldKind === 'array' && field.arrayItemFields) {
      lines.push(...generateSetArrayField(field, accessor, '      '));
      continue;
    }
    if (field.fieldKind === 'object' && field.objectFields) {
      lines.push(...generateSetObjectField(field, accessor, '      '));
      continue;
    }

    const info = getHtmlInputType(field.dtype);
    const id = field.name;
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
/**
 * Generate get-data JS for array fields, reading card inputs into an array.
 */
function generateGetArrayField(field: FormField, assignPath: string, indent: string): string[] {
  const lines: string[] = [];
  const fullName = field.name;
  const containerId = `array-${fullName}`;
  const itemFields = field.arrayItemFields || [];

  lines.push(`${indent}(function() {`);
  lines.push(`${indent}  var container = document.getElementById("${containerId}");`);
  lines.push(`${indent}  if (!container) return;`);
  lines.push(`${indent}  var cards = container.querySelectorAll(".array-card");`);
  lines.push(`${indent}  var result = [];`);
  lines.push(`${indent}  for (var i = 0; i < cards.length; i++) {`);
  lines.push(`${indent}    var item = {};`);
  for (const sub of itemFields) {
    const info = getHtmlInputType(sub.dtype);
    if (info.type === 'checkbox') {
      lines.push(`${indent}    var cb = cards[i].querySelector('[data-field="${sub.name}"]'); if (cb) item["${sub.name}"] = cb.checked;`);
    } else if (info.type === 'number') {
      lines.push(`${indent}    var inp = cards[i].querySelector('[data-field="${sub.name}"]'); if (inp) item["${sub.name}"] = Number(inp.value);`);
    } else {
      lines.push(`${indent}    var inp = cards[i].querySelector('[data-field="${sub.name}"]'); if (inp) item["${sub.name}"] = inp.value;`);
    }
  }
  lines.push(`${indent}    result.push(item);`);
  lines.push(`${indent}  }`);
  lines.push(`${indent}  ${assignPath} = result;`);
  lines.push(`${indent}})();`);
  return lines;
}

/**
 * Generate get-data JS for expanded object fields, recursing into sub-fields.
 */
function generateGetObjectField(field: FormField, assignPath: string, indent: string): string[] {
  const lines: string[] = [];
  const objectFields = field.objectFields || [];
  lines.push(`${indent}${assignPath} = {};`);
  for (const sub of objectFields) {
    const subAssign = `${assignPath}["${sub.name}"]`;
    if (sub.fieldKind === 'array' && sub.arrayItemFields) {
      const subWithFullName: FormField = { ...sub, name: `${field.name}.${sub.name}` };
      lines.push(...generateGetArrayField(subWithFullName, subAssign, indent));
    } else if (sub.fieldKind === 'object' && sub.objectFields) {
      const subWithFullName: FormField = { ...sub, name: `${field.name}.${sub.name}` };
      lines.push(...generateGetObjectField(subWithFullName, subAssign, indent));
    } else {
      const subId = `${field.name}.${sub.name}`;
      const info = getHtmlInputType(sub.dtype);
      if (info.type === 'checkbox') {
        lines.push(`${indent}${subAssign} = document.getElementById("${subId}").checked;`);
      } else if (info.type === 'number') {
        lines.push(`${indent}${subAssign} = Number(document.getElementById("${subId}").value);`);
      } else {
        lines.push(`${indent}${subAssign} = document.getElementById("${subId}").value;`);
      }
    }
  }
  return lines;
}

/**
 * Build a nested assignment path for a dot-notation field name.
 * Ensures parent objects are initialized along the way.
 * e.g. "pull_request.checks" → initializes formData.pull_request, returns formData.pull_request.checks
 */
function buildNestedAssignPath(name: string, initializedPrefixes: Set<string>, lines: string[]): string {
  if (!name.includes('.')) {
    return propAccess('formData', name);
  }

  const parts = name.split('.');
  const prefix = parts[0];
  if (!initializedPrefixes.has(prefix)) {
    const prefixAccess = propAccess('formData', prefix);
    lines.push(`      ${prefixAccess} = ${prefixAccess} || {};`);
    initializedPrefixes.add(prefix);
  }

  let assignPath = 'formData';
  for (const part of parts) {
    assignPath = propAccess(assignPath, part);
  }
  return assignPath;
}

function generateGetFormDataBody(fields: FormField[]): string {
  const lines: string[] = [];
  const initializedPrefixes = new Set<string>();

  for (const field of fields) {
    // Handle expanded object/array fieldKinds
    if (field.fieldKind === 'array' && field.arrayItemFields) {
      const assignPath = buildNestedAssignPath(field.name, initializedPrefixes, lines);
      lines.push(...generateGetArrayField(field, assignPath, '      '));
      continue;
    }
    if (field.fieldKind === 'object' && field.objectFields) {
      const assignPath = buildNestedAssignPath(field.name, initializedPrefixes, lines);
      lines.push(...generateGetObjectField(field, assignPath, '      '));
      continue;
    }

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
  const normalized = dtype.replace(/^java\.(lang|util|time)\./, '').toLowerCase();
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
    case 'date':
    case 'localdate':
    case 'localdatetime':
      return 'string';
    default:
      return 'object';
  }
}

/**
 * Build a JSON Schema property for a FormField, handling array/object fieldKinds recursively.
 */
function fieldToJsonSchema(field: FormField): Record<string, unknown> {
  if (field.fieldKind === 'array' && field.arrayItemFields) {
    const itemProperties: Record<string, { type: string }> = {};
    for (const sub of field.arrayItemFields) {
      itemProperties[sub.name] = { type: dtypeToJsonSchemaType(sub.dtype) };
    }
    return {
      type: 'array',
      items: {
        type: 'object',
        properties: itemProperties
      }
    };
  }

  if (field.fieldKind === 'object' && field.objectFields) {
    const subProperties: Record<string, unknown> = {};
    for (const sub of field.objectFields) {
      subProperties[sub.name] = fieldToJsonSchema(sub);
    }
    return {
      type: 'object',
      properties: subProperties
    };
  }

  return { type: dtypeToJsonSchemaType(field.dtype) };
}

/**
 * Generate the JSON config (schema + no external resources) for a user task form.
 * Supports dot-notation fields by generating $defs for grouped types.
 * Supports expanded object/array fields with nested schemas.
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

  // Add flat fields (including expanded object/array fields)
  for (const field of flat) {
    properties[field.name] = fieldToJsonSchema(field);
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
    resources: {
      styles: {},
      scripts: {}
    }
  };

  return JSON.stringify(config, null, 2) + '\n';
}
