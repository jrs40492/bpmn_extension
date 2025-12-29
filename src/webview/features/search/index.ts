/**
 * Element Search Feature
 * Search for elements by name or ID within the diagram
 */

interface Element {
  id: string;
  type: string;
  businessObject: {
    id: string;
    name?: string;
    $type: string;
  };
}

interface ElementRegistry {
  getAll(): Element[];
  get(id: string): Element | undefined;
}

interface Canvas {
  zoom(level: number | 'fit-viewport', center?: { x: number; y: number }): void;
  scrollToElement(element: Element): void;
}

interface Selection {
  select(element: Element): void;
  deselect(element: Element): void;
}

interface SearchResult {
  element: Element;
  name: string;
  id: string;
  type: string;
  matchType: 'name' | 'id';
}

export function initSearchPanel(
  elementRegistry: ElementRegistry,
  canvas: Canvas,
  selection: Selection
): { show: () => void; hide: () => void; toggle: () => void } {
  const panel = createSearchPanelHTML();
  document.body.appendChild(panel);

  const input = panel.querySelector('#element-search-input') as HTMLInputElement;
  const results = panel.querySelector('.search-results') as HTMLDivElement;
  const closeButton = panel.querySelector('.search-panel-close') as HTMLButtonElement;
  const countSpan = panel.querySelector('.search-result-count') as HTMLSpanElement;

  let isVisible = false;

  closeButton.addEventListener('click', () => {
    hide();
  });

  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();
    if (query.length < 1) {
      results.innerHTML = '<div class="search-empty">Type to search elements...</div>';
      countSpan.textContent = '';
      return;
    }

    const searchResults = searchElements(elementRegistry, query);
    renderResults(searchResults, results, countSpan, canvas, selection, hide);
  });

  // Handle keyboard shortcuts
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hide();
    } else if (e.key === 'Enter') {
      const firstResult = results.querySelector('.search-result-item') as HTMLElement;
      if (firstResult) {
        firstResult.click();
      }
    }
  });

  function show() {
    isVisible = true;
    panel.classList.add('visible');
    input.value = '';
    results.innerHTML = '<div class="search-empty">Type to search elements...</div>';
    countSpan.textContent = '';
    setTimeout(() => input.focus(), 100);
  }

  function hide() {
    isVisible = false;
    panel.classList.remove('visible');
  }

  function toggle() {
    if (isVisible) {
      hide();
    } else {
      show();
    }
  }

  return { show, hide, toggle };
}

function searchElements(elementRegistry: ElementRegistry, query: string): SearchResult[] {
  const allElements = elementRegistry.getAll();
  const results: SearchResult[] = [];

  for (const element of allElements) {
    // Skip diagram elements (planes, diagrams, etc.)
    if (!element.businessObject || element.type.includes('bpmndi:') || element.type.includes('label')) {
      continue;
    }

    const name = element.businessObject.name || '';
    const id = element.businessObject.id || element.id;
    const type = formatElementType(element.businessObject.$type);

    // Check for matches
    if (name.toLowerCase().includes(query)) {
      results.push({ element, name, id, type, matchType: 'name' });
    } else if (id.toLowerCase().includes(query)) {
      results.push({ element, name, id, type, matchType: 'id' });
    }
  }

  // Sort by relevance (exact matches first, then by name)
  results.sort((a, b) => {
    const aExact = a.name.toLowerCase() === query || a.id.toLowerCase() === query;
    const bExact = b.name.toLowerCase() === query || b.id.toLowerCase() === query;
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;
    return (a.name || a.id).localeCompare(b.name || b.id);
  });

  return results;
}

function formatElementType(type: string): string {
  // Remove bpmn: prefix and add spaces before capitals
  return type
    .replace('bpmn:', '')
    .replace(/([A-Z])/g, ' $1')
    .trim();
}

function getElementIcon(type: string): string {
  const typeMap: Record<string, string> = {
    'StartEvent': '🟢',
    'EndEvent': '🔴',
    'IntermediateCatchEvent': '🟡',
    'IntermediateThrowEvent': '🟡',
    'Task': '📋',
    'UserTask': '👤',
    'ServiceTask': '⚙️',
    'ScriptTask': '📝',
    'ManualTask': '✋',
    'SendTask': '📤',
    'ReceiveTask': '📥',
    'ExclusiveGateway': '◇',
    'ParallelGateway': '⊕',
    'InclusiveGateway': '◎',
    'SubProcess': '📦',
    'DataObject': '📄',
    'DataStore': '🗄️',
    'SequenceFlow': '→',
    'MessageFlow': '✉️',
    'TextAnnotation': '💬',
    'Group': '▭',
    'Participant': '🏊',
    'Lane': '≡'
  };

  for (const [key, icon] of Object.entries(typeMap)) {
    if (type.includes(key)) {
      return icon;
    }
  }
  return '•';
}

function renderResults(
  searchResults: SearchResult[],
  container: HTMLDivElement,
  countSpan: HTMLSpanElement,
  canvas: Canvas,
  selection: Selection,
  onSelect: () => void
): void {
  if (searchResults.length === 0) {
    container.innerHTML = '<div class="search-empty">No elements found</div>';
    countSpan.textContent = '';
    return;
  }

  countSpan.textContent = `${searchResults.length} found`;

  container.innerHTML = searchResults.map(result => {
    const icon = getElementIcon(result.type);
    const displayName = result.name || `(${result.id})`;
    const subtitle = result.name ? result.id : result.type;

    return `
      <div class="search-result-item" data-element-id="${result.element.id}">
        <span class="search-result-icon">${icon}</span>
        <div class="search-result-info">
          <div class="search-result-name">${escapeHtml(displayName)}</div>
          <div class="search-result-meta">${escapeHtml(result.type)} · ${escapeHtml(subtitle)}</div>
        </div>
      </div>
    `;
  }).join('');

  // Add click handlers
  const items = container.querySelectorAll('.search-result-item');
  items.forEach(item => {
    item.addEventListener('click', () => {
      const elementId = item.getAttribute('data-element-id');
      if (elementId) {
        const element = searchResults.find(r => r.element.id === elementId)?.element;
        if (element) {
          // Select and center on element
          selection.select(element);
          try {
            canvas.scrollToElement(element);
          } catch {
            // Fallback if scrollToElement not available
          }
          onSelect();
        }
      }
    });
  });
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function createSearchPanelHTML(): HTMLDivElement {
  const panel = document.createElement('div');
  panel.id = 'search-panel';
  panel.className = 'search-panel';

  panel.innerHTML = `
    <div class="search-panel-header">
      <div class="search-input-wrapper">
        <span class="search-icon">🔍</span>
        <input type="text" id="element-search-input" placeholder="Search elements by name or ID..." autocomplete="off" />
        <span class="search-result-count"></span>
      </div>
      <button class="search-panel-close" title="Close (Esc)">&times;</button>
    </div>
    <div class="search-results">
      <div class="search-empty">Type to search elements...</div>
    </div>
  `;

  return panel;
}
