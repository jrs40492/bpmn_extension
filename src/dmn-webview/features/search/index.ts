/**
 * Search Feature for DMN Editor
 */

export interface SearchResult {
  id: string;
  name: string;
  type: 'decision' | 'inputData' | 'knowledgeSource' | 'businessKnowledgeModel' | 'decisionService';
  element: any;
}

export class DmnSearchEngine {
  private elements: SearchResult[] = [];
  private dmnModeler: any = null;

  setModeler(modeler: any): void {
    this.dmnModeler = modeler;
    this.indexElements();
  }

  indexElements(): void {
    if (!this.dmnModeler) return;
    this.elements = [];

    try {
      const definitions = this.dmnModeler.getDefinitions();
      if (!definitions) return;

      const getElementType = (element: any): SearchResult['type'] | null => {
        const type = element.$type;
        if (type === 'dmn:Decision') return 'decision';
        if (type === 'dmn:InputData') return 'inputData';
        if (type === 'dmn:KnowledgeSource') return 'knowledgeSource';
        if (type === 'dmn:BusinessKnowledgeModel') return 'businessKnowledgeModel';
        if (type === 'dmn:DecisionService') return 'decisionService';
        return null;
      };

      const drgElements = definitions.drgElement || [];
      for (const element of drgElements) {
        const type = getElementType(element);
        if (type) {
          this.elements.push({ id: element.id, name: element.name || element.id, type, element });
        }
      }
    } catch (err) {
      console.error('[DMN Search] Failed to index elements:', err);
    }
  }

  search(query: string): SearchResult[] {
    if (!query || query.trim() === '') return [];
    const searchTerm = query.toLowerCase();
    return this.elements.filter(element => {
      const name = element.name.toLowerCase();
      const id = element.id.toLowerCase();
      return name.includes(searchTerm) || id.includes(searchTerm);
    });
  }

  navigateTo(result: SearchResult): void {
    if (!this.dmnModeler) return;
    try {
      const activeView = this.dmnModeler.getActiveView();
      if (activeView?.type === 'drd') {
        const viewer = this.dmnModeler.getActiveViewer();
        const canvas = viewer?.get('canvas');
        const selection = viewer?.get('selection');
        const elementRegistry = viewer?.get('elementRegistry');
        if (canvas && elementRegistry) {
          const shape = elementRegistry.get(result.id);
          if (shape) {
            selection?.select(shape);
            canvas.scrollToElement(shape);
          }
        }
      }
    } catch (err) {
      console.error('[DMN Search] Failed to navigate:', err);
    }
  }
}

export function createSearchPanel(
  engine: DmnSearchEngine,
  onClose: () => void,
  onNavigate: (result: SearchResult) => void
): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'dmn-search-panel';
  panel.id = 'dmn-search-panel';

  panel.innerHTML = `
    <div class="search-input-wrapper">
      <span class="icon">🔍</span>
      <input type="text" class="search-input" id="dmn-search-input" placeholder="Search decisions, inputs..." autocomplete="off">
      <button class="search-close-btn" title="Close">✕</button>
    </div>
    <div class="search-results" id="search-results">
      <div class="search-no-results">Type to search...</div>
    </div>
  `;

  const input = panel.querySelector('#dmn-search-input') as HTMLInputElement;
  const resultsDiv = panel.querySelector('#search-results') as HTMLElement;

  setTimeout(() => input?.focus(), 100);
  panel.querySelector('.search-close-btn')?.addEventListener('click', onClose);

  let debounceTimer: number | null = null;
  input?.addEventListener('input', () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      const query = input.value.trim();
      const results = engine.search(query);
      displaySearchResults(resultsDiv, results, query, onNavigate, onClose);
    }, 150);
  });

  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'Enter') {
      const firstResult = resultsDiv.querySelector('.search-result-item') as HTMLElement;
      firstResult?.click();
    }
  });

  return panel;
}

function displaySearchResults(
  container: HTMLElement,
  results: SearchResult[],
  query: string,
  onNavigate: (result: SearchResult) => void,
  onClose: () => void
): void {
  if (!query) {
    container.innerHTML = '<div class="search-no-results">Type to search...</div>';
    return;
  }

  if (results.length === 0) {
    container.innerHTML = `<div class="search-no-results">No results found for "${escapeHtml(query)}"</div>`;
    return;
  }

  const typeIcons: Record<SearchResult['type'], string> = {
    decision: '📋', inputData: '📥', knowledgeSource: '📚', businessKnowledgeModel: '🧠', decisionService: '⚙️'
  };

  const typeLabels: Record<SearchResult['type'], string> = {
    decision: 'Decision', inputData: 'Input Data', knowledgeSource: 'Knowledge Source', businessKnowledgeModel: 'Business Knowledge', decisionService: 'Decision Service'
  };

  container.innerHTML = results.map((result, index) => `
    <div class="search-result-item" tabindex="0" data-result-index="${index}">
      <span class="search-result-icon ${result.type}">${typeIcons[result.type]}</span>
      <div class="search-result-info">
        <div class="search-result-name">${highlightMatch(result.name, query)}</div>
        <div class="search-result-type">${typeLabels[result.type]}</div>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.search-result-item').forEach((item, index) => {
    item.addEventListener('click', () => { onNavigate(results[index]); onClose(); });
  });
}

function highlightMatch(text: string, query: string): string {
  if (!query) return escapeHtml(text);
  const escaped = escapeHtml(text);
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return escaped.replace(regex, '<strong>$1</strong>');
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export const dmnSearchEngine = new DmnSearchEngine();
