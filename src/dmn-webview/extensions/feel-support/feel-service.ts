/**
 * FEEL Expression Service
 *
 * Provides FEEL expression parsing, validation, and evaluation
 * using the feelin library (Drools-compatible FEEL implementation).
 *
 * @see https://github.com/nikku/feelin
 */

import {
  parseExpression,
  parseUnaryTests,
  evaluate,
  unaryTest,
  SyntaxError
} from 'feelin';

export interface FeelError {
  message: string;
  from: number;
  to: number;
  severity: 'error' | 'warning';
}

export interface FeelValidationResult {
  valid: boolean;
  errors: FeelError[];
  parsed?: any;
}

export interface FeelEvaluationResult {
  success: boolean;
  value?: any;
  error?: string;
}

/**
 * Validate a FEEL expression (for output cells, literal expressions)
 */
export function validateExpression(expression: string, context: Record<string, any> = {}): FeelValidationResult {
  if (!expression || expression.trim() === '' || expression.trim() === '-') {
    return { valid: true, errors: [] };
  }

  try {
    const tree = parseExpression(expression, context);
    const errors: FeelError[] = [];

    // Check for syntax errors in the parse tree
    tree.iterate({
      enter: (node) => {
        if (node.type.isError) {
          errors.push({
            message: `Syntax error at position ${node.from}`,
            from: node.from,
            to: node.to,
            severity: 'error'
          });
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      parsed: tree
    };
  } catch (err) {
    if (err instanceof SyntaxError) {
      return {
        valid: false,
        errors: [{
          message: err.message,
          from: err.position.from,
          to: err.position.to,
          severity: 'error'
        }]
      };
    }
    return {
      valid: false,
      errors: [{
        message: err instanceof Error ? err.message : 'Unknown error',
        from: 0,
        to: expression.length,
        severity: 'error'
      }]
    };
  }
}

/**
 * Validate a FEEL unary test expression (for input cells in decision tables)
 *
 * Examples:
 * - "< 100"
 * - "[1..10]"
 * - '"approved", "pending"'
 * - "not(null)"
 */
export function validateUnaryTest(expression: string, context: Record<string, any> = {}): FeelValidationResult {
  if (!expression || expression.trim() === '' || expression.trim() === '-') {
    return { valid: true, errors: [] };
  }

  try {
    const tree = parseUnaryTests(expression, context);
    const errors: FeelError[] = [];

    // Check for syntax errors in the parse tree
    tree.iterate({
      enter: (node) => {
        if (node.type.isError) {
          errors.push({
            message: `Syntax error at position ${node.from}`,
            from: node.from,
            to: node.to,
            severity: 'error'
          });
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      parsed: tree
    };
  } catch (err) {
    if (err instanceof SyntaxError) {
      return {
        valid: false,
        errors: [{
          message: err.message,
          from: err.position.from,
          to: err.position.to,
          severity: 'error'
        }]
      };
    }
    return {
      valid: false,
      errors: [{
        message: err instanceof Error ? err.message : 'Unknown error',
        from: 0,
        to: expression.length,
        severity: 'error'
      }]
    };
  }
}

/**
 * Evaluate a FEEL expression
 */
export function evaluateExpression(expression: string, context: Record<string, any> = {}): FeelEvaluationResult {
  if (!expression || expression.trim() === '' || expression.trim() === '-') {
    return { success: true, value: null };
  }

  try {
    const value = evaluate(expression, context);
    return { success: true, value };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Evaluation failed'
    };
  }
}

/**
 * Evaluate a unary test against an input value
 */
export function evaluateUnaryTest(expression: string, inputValue: any, context: Record<string, any> = {}): FeelEvaluationResult {
  if (!expression || expression.trim() === '' || expression.trim() === '-') {
    return { success: true, value: true }; // "-" means any value matches
  }

  try {
    // The '?' is the placeholder for the input value in unary tests
    const testContext = { ...context, '?': inputValue };
    const value = unaryTest(expression, testContext);
    return { success: true, value };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Evaluation failed'
    };
  }
}

/**
 * Get FEEL expression type based on content
 */
export function getExpressionType(expression: string): 'empty' | 'literal' | 'comparison' | 'range' | 'list' | 'function' | 'complex' {
  if (!expression || expression.trim() === '' || expression.trim() === '-') {
    return 'empty';
  }

  const trimmed = expression.trim();

  // Check for range expressions [a..b] or (a..b)
  if (/^[\[\(].+\.\..*[\]\)]$/.test(trimmed)) {
    return 'range';
  }

  // Check for list expressions "a", "b", "c"
  if (/^"[^"]*"(\s*,\s*"[^"]*")+$/.test(trimmed)) {
    return 'list';
  }

  // Check for comparison operators
  if (/^[<>=!]/.test(trimmed)) {
    return 'comparison';
  }

  // Check for function calls
  if (/^\w+\s*\(/.test(trimmed)) {
    return 'function';
  }

  // Check for simple literals (numbers, strings, booleans)
  if (/^-?\d+(\.\d+)?$/.test(trimmed) || // numbers
      /^"[^"]*"$/.test(trimmed) ||       // strings
      /^(true|false|null)$/.test(trimmed)) { // booleans/null
    return 'literal';
  }

  return 'complex';
}

/**
 * FEEL built-in function documentation
 */
export const FEEL_FUNCTIONS: Record<string, { signature: string; description: string; example: string }> = {
  // Conversion functions
  'number': {
    signature: 'number(from, grouping separator, decimal separator)',
    description: 'Converts a string to a number',
    example: 'number("1,000.50", ",", ".") = 1000.50'
  },
  'string': {
    signature: 'string(from)',
    description: 'Converts a value to a string',
    example: 'string(123) = "123"'
  },
  'date': {
    signature: 'date(from) or date(year, month, day)',
    description: 'Creates a date value',
    example: 'date("2024-12-29") or date(2024, 12, 29)'
  },
  'time': {
    signature: 'time(from) or time(hour, minute, second, offset)',
    description: 'Creates a time value',
    example: 'time("14:30:00") or time(14, 30, 0)'
  },
  'date and time': {
    signature: 'date and time(from) or date and time(date, time)',
    description: 'Creates a date-time value',
    example: 'date and time("2024-12-29T14:30:00")'
  },
  'duration': {
    signature: 'duration(from)',
    description: 'Creates a duration value',
    example: 'duration("P1Y2M") or duration("PT2H30M")'
  },

  // Boolean functions
  'not': {
    signature: 'not(value)',
    description: 'Negates a boolean value',
    example: 'not(true) = false'
  },

  // String functions
  'substring': {
    signature: 'substring(string, start position, length?)',
    description: 'Returns a substring',
    example: 'substring("testing", 3) = "sting"'
  },
  'string length': {
    signature: 'string length(string)',
    description: 'Returns the length of a string',
    example: 'string length("hello") = 5'
  },
  'upper case': {
    signature: 'upper case(string)',
    description: 'Converts to uppercase',
    example: 'upper case("hello") = "HELLO"'
  },
  'lower case': {
    signature: 'lower case(string)',
    description: 'Converts to lowercase',
    example: 'lower case("HELLO") = "hello"'
  },
  'contains': {
    signature: 'contains(string, match)',
    description: 'Checks if string contains match',
    example: 'contains("hello world", "world") = true'
  },
  'starts with': {
    signature: 'starts with(string, match)',
    description: 'Checks if string starts with match',
    example: 'starts with("hello", "he") = true'
  },
  'ends with': {
    signature: 'ends with(string, match)',
    description: 'Checks if string ends with match',
    example: 'ends with("hello", "lo") = true'
  },
  'matches': {
    signature: 'matches(input, pattern, flags?)',
    description: 'Checks if input matches regex pattern',
    example: 'matches("hello", "h.*o") = true'
  },
  'replace': {
    signature: 'replace(input, pattern, replacement, flags?)',
    description: 'Replaces pattern in string',
    example: 'replace("hello", "l", "L") = "heLLo"'
  },
  'split': {
    signature: 'split(string, delimiter)',
    description: 'Splits string by delimiter',
    example: 'split("a,b,c", ",") = ["a", "b", "c"]'
  },

  // List functions
  'list contains': {
    signature: 'list contains(list, element)',
    description: 'Checks if list contains element',
    example: 'list contains([1, 2, 3], 2) = true'
  },
  'count': {
    signature: 'count(list)',
    description: 'Returns the number of elements',
    example: 'count([1, 2, 3]) = 3'
  },
  'min': {
    signature: 'min(list) or min(values...)',
    description: 'Returns the minimum value',
    example: 'min([1, 5, 3]) = 1'
  },
  'max': {
    signature: 'max(list) or max(values...)',
    description: 'Returns the maximum value',
    example: 'max([1, 5, 3]) = 5'
  },
  'sum': {
    signature: 'sum(list) or sum(values...)',
    description: 'Returns the sum of values',
    example: 'sum([1, 2, 3]) = 6'
  },
  'mean': {
    signature: 'mean(list) or mean(values...)',
    description: 'Returns the average value',
    example: 'mean([1, 2, 3]) = 2'
  },
  'all': {
    signature: 'all(list)',
    description: 'Returns true if all elements are true',
    example: 'all([true, true, false]) = false'
  },
  'any': {
    signature: 'any(list)',
    description: 'Returns true if any element is true',
    example: 'any([false, false, true]) = true'
  },
  'append': {
    signature: 'append(list, items...)',
    description: 'Appends items to a list',
    example: 'append([1, 2], 3) = [1, 2, 3]'
  },
  'concatenate': {
    signature: 'concatenate(lists...)',
    description: 'Concatenates multiple lists',
    example: 'concatenate([1, 2], [3, 4]) = [1, 2, 3, 4]'
  },
  'distinct values': {
    signature: 'distinct values(list)',
    description: 'Returns unique values from list',
    example: 'distinct values([1, 2, 1, 3]) = [1, 2, 3]'
  },
  'flatten': {
    signature: 'flatten(nested list)',
    description: 'Flattens nested lists',
    example: 'flatten([[1, 2], [3, 4]]) = [1, 2, 3, 4]'
  },
  'reverse': {
    signature: 'reverse(list)',
    description: 'Reverses a list',
    example: 'reverse([1, 2, 3]) = [3, 2, 1]'
  },
  'sort': {
    signature: 'sort(list, precedes function)',
    description: 'Sorts a list',
    example: 'sort([3, 1, 2], function(x, y) x < y) = [1, 2, 3]'
  },

  // Numeric functions
  'abs': {
    signature: 'abs(number)',
    description: 'Returns absolute value',
    example: 'abs(-5) = 5'
  },
  'ceiling': {
    signature: 'ceiling(number)',
    description: 'Rounds up to nearest integer',
    example: 'ceiling(1.5) = 2'
  },
  'floor': {
    signature: 'floor(number)',
    description: 'Rounds down to nearest integer',
    example: 'floor(1.5) = 1'
  },
  'round': {
    signature: 'round(number, scale)',
    description: 'Rounds to specified decimal places',
    example: 'round(1.567, 2) = 1.57'
  },
  'decimal': {
    signature: 'decimal(number, scale)',
    description: 'Returns number with specified scale',
    example: 'decimal(1.567, 2) = 1.56'
  },
  'modulo': {
    signature: 'modulo(dividend, divisor)',
    description: 'Returns the remainder',
    example: 'modulo(10, 3) = 1'
  },
  'sqrt': {
    signature: 'sqrt(number)',
    description: 'Returns square root',
    example: 'sqrt(16) = 4'
  },
  'log': {
    signature: 'log(number)',
    description: 'Returns natural logarithm',
    example: 'log(10) = 2.302585...'
  },
  'exp': {
    signature: 'exp(number)',
    description: 'Returns e raised to the power',
    example: 'exp(1) = 2.718281...'
  },
  'odd': {
    signature: 'odd(number)',
    description: 'Checks if number is odd',
    example: 'odd(5) = true'
  },
  'even': {
    signature: 'even(number)',
    description: 'Checks if number is even',
    example: 'even(4) = true'
  },

  // Context functions
  'get value': {
    signature: 'get value(context, key)',
    description: 'Gets value from context by key',
    example: 'get value({a: 1, b: 2}, "a") = 1'
  },
  'get entries': {
    signature: 'get entries(context)',
    description: 'Gets list of key-value pairs',
    example: 'get entries({a: 1}) = [{key: "a", value: 1}]'
  },
  'context': {
    signature: 'context(entries)',
    description: 'Creates context from entries list',
    example: 'context([{key: "a", value: 1}]) = {a: 1}'
  }
};
