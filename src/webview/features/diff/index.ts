/**
 * Version Diff Feature
 * Visual diff between diagram versions
 */

interface DiffChange {
  type: 'added' | 'removed' | 'modified';
  elementId: string;
  elementType: string;
  elementName?: string;
  details?: string;
}

interface ParsedElement {
  id: string;
  type: string;
  name?: string;
  attributes: Record<string, string>;
}

export function initDiffPanel(
  getCurrentXml: () => Promise<string>,
  onApplyVersion: (xml: string) => void
): {
  show: () => void;
  hide: () => void;
  compareWith: (otherXml: string, label?: string) => void;
} {
  const panel = createDiffPanelHTML();
  document.body.appendChild(panel);

  const closeButton = panel.querySelector('.diff-panel-close') as HTMLButtonElement;
  const loadButton = panel.querySelector('.diff-load-btn') as HTMLButtonElement;
  const fileInput = panel.querySelector('#diff-file-input') as HTMLInputElement;
  const diffResults = panel.querySelector('.diff-results') as HTMLDivElement;
  const summaryDiv = panel.querySelector('.diff-summary') as HTMLDivElement;

  let storedOtherXml: string | null = null;

  closeButton.addEventListener('click', () => {
    panel.classList.remove('visible');
  });

  loadButton.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    try {
      const otherXml = await file.text();
      const currentXml = await getCurrentXml();
      const changes = compareXml(currentXml, otherXml);
      renderDiff(changes, diffResults, summaryDiv, file.name);
      storedOtherXml = otherXml;
    } catch (err) {
      diffResults.innerHTML = `<div class="diff-error">Error reading file: ${err}</div>`;
    }

    fileInput.value = '';
  });

  function show() {
    panel.classList.add('visible');
    diffResults.innerHTML = '<div class="diff-empty">Load a BPMN file to compare with current diagram</div>';
    summaryDiv.innerHTML = '';
  }

  function hide() {
    panel.classList.remove('visible');
  }

  function compareWith(otherXml: string, label = 'Previous Version') {
    getCurrentXml().then(currentXml => {
      const changes = compareXml(currentXml, otherXml);
      renderDiff(changes, diffResults, summaryDiv, label);
      storedOtherXml = otherXml;
      panel.classList.add('visible');
    });
  }

  return { show, hide, compareWith };
}

function parseElements(xml: string): Map<string, ParsedElement> {
  const elements = new Map<string, ParsedElement>();

  // Simple XML parsing for BPMN elements
  const elementRegex = /<bpmn:(\w+)\s+([^>]*?)(?:\/>|>)/g;
  let match;

  while ((match = elementRegex.exec(xml)) !== null) {
    const type = match[1];
    const attributesStr = match[2];

    // Parse attributes
    const attributes: Record<string, string> = {};
    const attrRegex = /(\w+)="([^"]*)"/g;
    let attrMatch;

    while ((attrMatch = attrRegex.exec(attributesStr)) !== null) {
      attributes[attrMatch[1]] = attrMatch[2];
    }

    if (attributes.id) {
      elements.set(attributes.id, {
        id: attributes.id,
        type: `bpmn:${type}`,
        name: attributes.name,
        attributes
      });
    }
  }

  return elements;
}

function compareXml(currentXml: string, otherXml: string): DiffChange[] {
  const currentElements = parseElements(currentXml);
  const otherElements = parseElements(otherXml);
  const changes: DiffChange[] = [];

  // Find added elements (in current but not in other)
  for (const [id, element] of currentElements) {
    if (!otherElements.has(id)) {
      changes.push({
        type: 'added',
        elementId: id,
        elementType: element.type,
        elementName: element.name
      });
    }
  }

  // Find removed elements (in other but not in current)
  for (const [id, element] of otherElements) {
    if (!currentElements.has(id)) {
      changes.push({
        type: 'removed',
        elementId: id,
        elementType: element.type,
        elementName: element.name
      });
    }
  }

  // Find modified elements
  for (const [id, currentEl] of currentElements) {
    const otherEl = otherElements.get(id);
    if (otherEl) {
      const modifications: string[] = [];

      // Check name change
      if (currentEl.name !== otherEl.name) {
        modifications.push(`Name: "${otherEl.name || '(none)'}" → "${currentEl.name || '(none)'}"`);
      }

      // Check other attribute changes
      const allAttrs = new Set([...Object.keys(currentEl.attributes), ...Object.keys(otherEl.attributes)]);
      for (const attr of allAttrs) {
        if (attr === 'id' || attr === 'name') continue;
        const curr = currentEl.attributes[attr];
        const other = otherEl.attributes[attr];
        if (curr !== other) {
          modifications.push(`${attr}: "${other || '(none)'}" → "${curr || '(none)'}"`);
        }
      }

      if (modifications.length > 0) {
        changes.push({
          type: 'modified',
          elementId: id,
          elementType: currentEl.type,
          elementName: currentEl.name,
          details: modifications.join(', ')
        });
      }
    }
  }

  return changes;
}

function renderDiff(
  changes: DiffChange[],
  container: HTMLDivElement,
  summaryDiv: HTMLDivElement,
  comparedTo: string
): void {
  const added = changes.filter(c => c.type === 'added');
  const removed = changes.filter(c => c.type === 'removed');
  const modified = changes.filter(c => c.type === 'modified');

  // Summary
  summaryDiv.innerHTML = `
    <div class="diff-summary-title">Compared to: ${escapeHtml(comparedTo)}</div>
    <div class="diff-summary-stats">
      <span class="diff-stat added">+${added.length} added</span>
      <span class="diff-stat removed">-${removed.length} removed</span>
      <span class="diff-stat modified">~${modified.length} modified</span>
    </div>
  `;

  if (changes.length === 0) {
    container.innerHTML = '<div class="diff-empty">No differences found - diagrams are identical</div>';
    return;
  }

  let html = '';

  // Render added
  if (added.length > 0) {
    html += `<div class="diff-section">
      <div class="diff-section-header added">Added Elements (${added.length})</div>
      ${added.map(c => renderChangeItem(c)).join('')}
    </div>`;
  }

  // Render removed
  if (removed.length > 0) {
    html += `<div class="diff-section">
      <div class="diff-section-header removed">Removed Elements (${removed.length})</div>
      ${removed.map(c => renderChangeItem(c)).join('')}
    </div>`;
  }

  // Render modified
  if (modified.length > 0) {
    html += `<div class="diff-section">
      <div class="diff-section-header modified">Modified Elements (${modified.length})</div>
      ${modified.map(c => renderChangeItem(c)).join('')}
    </div>`;
  }

  container.innerHTML = html;
}

function renderChangeItem(change: DiffChange): string {
  const icon = change.type === 'added' ? '+' : change.type === 'removed' ? '-' : '~';
  const name = change.elementName || change.elementId;
  const type = formatType(change.elementType);

  return `
    <div class="diff-item ${change.type}">
      <span class="diff-item-icon">${icon}</span>
      <div class="diff-item-info">
        <div class="diff-item-name">${escapeHtml(name)}</div>
        <div class="diff-item-meta">${escapeHtml(type)} · ${escapeHtml(change.elementId)}</div>
        ${change.details ? `<div class="diff-item-details">${escapeHtml(change.details)}</div>` : ''}
      </div>
    </div>
  `;
}

function formatType(type: string): string {
  return type.replace('bpmn:', '').replace(/([A-Z])/g, ' $1').trim();
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function createDiffPanelHTML(): HTMLDivElement {
  const panel = document.createElement('div');
  panel.id = 'diff-panel';
  panel.className = 'diff-panel';

  panel.innerHTML = `
    <div class="diff-panel-header">
      <span class="diff-panel-icon">📊</span>
      <span class="diff-panel-title">Version Diff</span>
      <button class="diff-panel-close" title="Close">&times;</button>
    </div>
    <div class="diff-toolbar">
      <button class="diff-load-btn">📂 Load File to Compare</button>
      <input type="file" id="diff-file-input" accept=".bpmn,.xml" hidden />
    </div>
    <div class="diff-summary"></div>
    <div class="diff-results">
      <div class="diff-empty">Load a BPMN file to compare with current diagram</div>
    </div>
  `;

  return panel;
}
