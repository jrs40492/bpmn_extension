/**
 * FEEL Reference Panel
 * 
 * Provides a quick reference panel for FEEL functions, keywords, and examples
 */

import { FEEL_FUNCTIONS } from '../../extensions/feel-support/feel-service';

export interface FeelReferenceCategory {
  name: string;
  icon: string;
  functions: Array<{
    name: string;
    signature: string;
    description: string;
    example: string;
  }>;
}

export class FeelReferenceEngine {
  private categories: FeelReferenceCategory[] = [];

  constructor() {
    this.initializeCategories();
  }

  private initializeCategories(): void {
    // Group FEEL functions by category
    const conversionFunctions = ['number', 'string', 'date', 'time', 'date and time', 'duration'];
    const stringFunctions = ['substring', 'string length', 'upper case', 'lower case', 'contains', 'starts with', 'ends with', 'matches', 'replace', 'split'];
    const listFunctions = ['list contains', 'count', 'min', 'max', 'sum', 'mean', 'all', 'any', 'append', 'concatenate', 'distinct values', 'flatten', 'reverse', 'sort'];
    const numericFunctions = ['abs', 'ceiling', 'floor', 'round', 'modulo'];
    const booleanFunctions = ['not'];

    this.categories = [
      {
        name: 'String Functions',
        icon: '📝',
        functions: stringFunctions.map(name => ({
          name,
          signature: FEEL_FUNCTIONS[name]?.signature || '',
          description: FEEL_FUNCTIONS[name]?.description || '',
          example: FEEL_FUNCTIONS[name]?.example || ''
        })).filter(f => f.signature)
      },
      {
        name: 'List Functions',
        icon: '📋',
        functions: listFunctions.map(name => ({
          name,
          signature: FEEL_FUNCTIONS[name]?.signature || '',
          description: FEEL_FUNCTIONS[name]?.description || '',
          example: FEEL_FUNCTIONS[name]?.example || ''
        })).filter(f => f.signature)
      },
      {
        name: 'Numeric Functions',
        icon: '🔢',
        functions: numericFunctions.map(name => ({
          name,
          signature: FEEL_FUNCTIONS[name]?.signature || '',
          description: FEEL_FUNCTIONS[name]?.description || '',
          example: FEEL_FUNCTIONS[name]?.example || ''
        })).filter(f => f.signature)
      },
      {
        name: 'Conversion Functions',
        icon: '🔄',
        functions: conversionFunctions.map(name => ({
          name,
          signature: FEEL_FUNCTIONS[name]?.signature || '',
          description: FEEL_FUNCTIONS[name]?.description || '',
          example: FEEL_FUNCTIONS[name]?.example || ''
        })).filter(f => f.signature)
      },
      {
        name: 'Boolean Functions',
        icon: '✓',
        functions: booleanFunctions.map(name => ({
          name,
          signature: FEEL_FUNCTIONS[name]?.signature || '',
          description: FEEL_FUNCTIONS[name]?.description || '',
          example: FEEL_FUNCTIONS[name]?.example || ''
        })).filter(f => f.signature)
      }
    ];
  }

  getCategories(): FeelReferenceCategory[] {
    return this.categories;
  }

  searchFunctions(query: string): Array<{ name: string; signature: string; description: string; example: string; category: string }> {
    const results: Array<{ name: string; signature: string; description: string; example: string; category: string }> = [];
    const searchTerm = query.toLowerCase();

    this.categories.forEach(category => {
      category.functions.forEach(func => {
        if (func.name.toLowerCase().includes(searchTerm) ||
            func.description.toLowerCase().includes(searchTerm)) {
          results.push({ ...func, category: category.name });
        }
      });
    });

    return results;
  }
}

export function createFeelReferencePanel(onClose: () => void): HTMLElement {
  const engine = new FeelReferenceEngine();
  const categories = engine.getCategories();

  const panel = document.createElement('div');
  panel.className = 'feel-reference-panel';
  panel.id = 'feel-reference-panel';

  panel.innerHTML = `
    <div class="feel-reference-header">
      <h3><span class="icon">📖</span> FEEL Quick Reference</h3>
      <div class="feel-reference-controls">
        <input type="text" class="feel-search-input" placeholder="Search functions..." id="feel-search">
        <button class="feel-reference-close-btn" title="Close">✕</button>
      </div>
    </div>
    <div class="feel-reference-body">
      <div class="feel-reference-sidebar">
        <div class="feel-reference-nav">
          ${categories.map((cat, index) => `
            <button class="feel-category-btn ${index === 0 ? 'active' : ''}" data-category="${index}">
              <span class="category-icon">${cat.icon}</span>
              <span class="category-name">${cat.name}</span>
            </button>
          `).join('')}
        </div>
      </div>
      <div class="feel-reference-content">
        <div id="feel-search-results" style="display: none;"></div>
        ${categories.map((cat, index) => `
          <div class="feel-category-content ${index === 0 ? 'active' : ''}" data-category="${index}">
            <h4>${cat.icon} ${cat.name}</h4>
            <div class="feel-functions-list">
              ${cat.functions.map(func => `
                <div class="feel-function-item">
                  <div class="feel-function-header">
                    <code class="feel-function-name">${escapeHtml(func.name)}</code>
                  </div>
                  <div class="feel-function-signature">
                    <code>${escapeHtml(func.signature)}</code>
                  </div>
                  <div class="feel-function-description">
                    ${escapeHtml(func.description)}
                  </div>
                  <div class="feel-function-example">
                    <strong>Example:</strong> <code>${escapeHtml(func.example)}</code>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Event handlers
  panel.querySelector('.feel-reference-close-btn')?.addEventListener('click', onClose);

  // Category navigation
  panel.querySelectorAll('.feel-category-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const categoryBtn = (e.target as HTMLElement).closest('.feel-category-btn') as HTMLElement;
      const categoryIndex = categoryBtn?.dataset.category;
      if (categoryIndex !== undefined) {
        // Update active category button
        panel.querySelectorAll('.feel-category-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update active content
        panel.querySelectorAll('.feel-category-content').forEach(c => c.classList.remove('active'));
        const content = panel.querySelector(`[data-category="${categoryIndex}"]`);
        content?.classList.add('active');

        // Hide search results
        const searchResults = panel.querySelector('#feel-search-results') as HTMLElement;
        if (searchResults) searchResults.style.display = 'none';
      }
    });
  });

  // Search functionality
  const searchInput = panel.querySelector('#feel-search') as HTMLInputElement;
  const searchResults = panel.querySelector('#feel-search-results') as HTMLElement;

  let searchTimeout: number | null = null;
  searchInput?.addEventListener('input', () => {
    if (searchTimeout) clearTimeout(searchTimeout);
    
    searchTimeout = window.setTimeout(() => {
      const query = searchInput.value.trim();
      
      if (query === '') {
        searchResults.style.display = 'none';
        // Show first category
        panel.querySelectorAll('.feel-category-content').forEach(c => c.classList.remove('active'));
        panel.querySelector('.feel-category-content[data-category="0"]')?.classList.add('active');
        
        panel.querySelectorAll('.feel-category-btn').forEach(b => b.classList.remove('active'));
        panel.querySelector('.feel-category-btn[data-category="0"]')?.classList.add('active');
        return;
      }

      const results = engine.searchFunctions(query);
      
      if (results.length === 0) {
        searchResults.innerHTML = '<div class="feel-no-results">No functions found matching your search.</div>';
      } else {
        searchResults.innerHTML = `
          <h4>🔍 Search Results (${results.length})</h4>
          <div class="feel-functions-list">
            ${results.map(func => `
              <div class="feel-function-item">
                <div class="feel-function-header">
                  <code class="feel-function-name">${escapeHtml(func.name)}</code>
                  <span class="feel-function-category">${func.category}</span>
                </div>
                <div class="feel-function-signature">
                  <code>${escapeHtml(func.signature)}</code>
                </div>
                <div class="feel-function-description">
                  ${escapeHtml(func.description)}
                </div>
                <div class="feel-function-example">
                  <strong>Example:</strong> <code>${escapeHtml(func.example)}</code>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }

      // Hide category contents and show search results
      panel.querySelectorAll('.feel-category-content').forEach(c => c.classList.remove('active'));
      searchResults.style.display = 'block';
    }, 300);
  });

  return panel;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export const feelReferenceEngine = new FeelReferenceEngine();