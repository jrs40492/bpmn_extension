/**
 * FEEL Autocomplete Service
 * 
 * Provides intelligent autocomplete functionality for FEEL expressions
 * using the comprehensive FEEL function documentation.
 */

import { FEEL_FUNCTIONS } from './feel-service';

export interface AutocompleteItem {
  label: string;
  insertText: string;
  detail: string;
  documentation: string;
  kind: 'function' | 'keyword' | 'variable' | 'constant';
  sortText?: string;
}

export interface AutocompleteResult {
  items: AutocompleteItem[];
  range: { start: number; end: number };
}

// FEEL keywords and operators
const FEEL_KEYWORDS = [
  'if', 'then', 'else', 'for', 'in', 'return', 'satisfies', 'some', 'every',
  'and', 'or', 'not', 'null', 'true', 'false', 'function', 'external'
];

const FEEL_OPERATORS = [
  '=', '!=', '<', '<=', '>', '>=', '+', '-', '*', '/', '**',
  'between', 'in', 'instance of'
];

export class FeelAutocompleteService {
  private contextVariables: Record<string, string> = {};

  setContext(variables: Record<string, string>): void {
    this.contextVariables = variables;
  }

  getCompletions(text: string, position: number): AutocompleteResult {
    const beforeCursor = text.substring(0, position);
    const afterCursor = text.substring(position);
    
    // Find the current word being typed
    const wordMatch = beforeCursor.match(/([a-zA-Z_][a-zA-Z0-9_\s]*)?$/);
    const currentWord = wordMatch ? wordMatch[1] || '' : '';
    const wordStart = position - currentWord.length;

    const items: AutocompleteItem[] = [];

    // Add FEEL functions
    Object.entries(FEEL_FUNCTIONS).forEach(([name, info]) => {
      if (!currentWord || name.toLowerCase().includes(currentWord.toLowerCase())) {
        // Extract parameter names from signature for smart insertion
        const paramMatch = info.signature.match(/\(([^)]*)\)/);
        const params = paramMatch ? paramMatch[1] : '';
        const paramNames = params ? params.split(',').map(p => p.trim().split(' ')[0]) : [];
        
        // Create insertion text with parameter placeholders
        const insertText = paramNames.length > 0 
          ? `${name}(${paramNames.map((p, i) => `\${${i + 1}:${p}}`).join(', ')})`
          : `${name}()`;

        items.push({
          label: name,
          insertText,
          detail: info.signature,
          documentation: `${info.description}\n\nExample: ${info.example}`,
          kind: 'function',
          sortText: `0_${name}` // Functions get priority
        });
      }
    });

    // Add FEEL keywords
    FEEL_KEYWORDS.forEach(keyword => {
      if (!currentWord || keyword.toLowerCase().includes(currentWord.toLowerCase())) {
        items.push({
          label: keyword,
          insertText: keyword,
          detail: 'FEEL keyword',
          documentation: `FEEL keyword: ${keyword}`,
          kind: 'keyword',
          sortText: `1_${keyword}`
        });
      }
    });

    // Add FEEL operators
    FEEL_OPERATORS.forEach(operator => {
      if (!currentWord || operator.toLowerCase().includes(currentWord.toLowerCase())) {
        items.push({
          label: operator,
          insertText: operator,
          detail: 'FEEL operator',
          documentation: `FEEL operator: ${operator}`,
          kind: 'keyword',
          sortText: `2_${operator}`
        });
      }
    });

    // Add context variables
    Object.entries(this.contextVariables).forEach(([name, type]) => {
      if (!currentWord || name.toLowerCase().includes(currentWord.toLowerCase())) {
        items.push({
          label: name,
          insertText: name,
          detail: `Variable (${type})`,
          documentation: `Context variable: ${name} of type ${type}`,
          kind: 'variable',
          sortText: `3_${name}`
        });
      }
    });

    // Add common constants
    const constants = [
      { name: 'null', doc: 'Null value' },
      { name: 'true', doc: 'Boolean true' },
      { name: 'false', doc: 'Boolean false' }
    ];

    constants.forEach(constant => {
      if (!currentWord || constant.name.toLowerCase().includes(currentWord.toLowerCase())) {
        items.push({
          label: constant.name,
          insertText: constant.name,
          detail: 'Constant',
          documentation: constant.doc,
          kind: 'constant',
          sortText: `4_${constant.name}`
        });
      }
    });

    // Sort items by relevance and alphabetically within categories
    items.sort((a, b) => {
      const sortA = a.sortText || a.label;
      const sortB = b.sortText || b.label;
      return sortA.localeCompare(sortB);
    });

    return {
      items: items.slice(0, 50), // Limit to 50 items for performance
      range: { start: wordStart, end: position }
    };
  }

  getFunctionHelp(functionName: string): AutocompleteItem | null {
    const func = FEEL_FUNCTIONS[functionName];
    if (!func) return null;

    return {
      label: functionName,
      insertText: functionName,
      detail: func.signature,
      documentation: `${func.description}\n\nExample: ${func.example}`,
      kind: 'function'
    };
  }

  // Get signature help for function parameters
  getSignatureHelp(text: string, position: number): { 
    signature: string; 
    activeParameter: number; 
    documentation: string;
  } | null {
    const beforeCursor = text.substring(0, position);
    
    // Find the function call we're inside of
    let parenCount = 0;
    let funcStart = -1;
    
    for (let i = position - 1; i >= 0; i--) {
      const char = text[i];
      if (char === ')') parenCount++;
      else if (char === '(') {
        parenCount--;
        if (parenCount < 0) {
          funcStart = i;
          break;
        }
      }
    }
    
    if (funcStart === -1) return null;
    
    // Extract function name
    const beforeParen = text.substring(0, funcStart);
    const funcMatch = beforeParen.match(/([a-zA-Z_][a-zA-Z0-9_\s]*)$/);
    if (!funcMatch) return null;
    
    const functionName = funcMatch[1].trim();
    const func = FEEL_FUNCTIONS[functionName];
    if (!func) return null;
    
    // Count parameters to determine active parameter
    const insideParens = text.substring(funcStart + 1, position);
    const activeParameter = insideParens.split(',').length - 1;
    
    return {
      signature: func.signature,
      activeParameter: Math.max(0, activeParameter),
      documentation: `${func.description}\n\nExample: ${func.example}`
    };
  }
}

export const feelAutocompleteService = new FeelAutocompleteService();