import type { AnalysisIssue, AnalysisResult } from './CodeReviewAnalyzer.js';

/**
 * Complexity Analyzer - Analyzes code complexity metrics
 */
export class ComplexityAnalyzer {
  /**
   * Analyze code for complexity issues
   */
  async analyze(code: string): Promise<AnalysisResult> {
    const issues: AnalysisIssue[] = [];
    
    const complexity = this.calculateComplexity(code);
    const functionMetrics = this.analyzeFunctions(code);
    
    // Check overall complexity
    if (complexity > 20) {
      issues.push({
        severity: 'error',
        category: 'complexity',
        message: `Very high cyclomatic complexity (${complexity}) - code should be refactored`,
        suggestion: 'Break down into smaller functions with single responsibilities',
      });
    } else if (complexity > 10) {
      issues.push({
        severity: 'warning',
        category: 'complexity',
        message: `High cyclomatic complexity (${complexity}) - consider simplifying`,
        suggestion: 'Look for opportunities to reduce branches and early returns',
      });
    }

    // Check function-level metrics
    for (const fn of functionMetrics) {
      if (fn.lines > 50) {
        issues.push({
          severity: 'warning',
          category: 'complexity',
          message: `Function "${fn.name}" is too long (${fn.lines} lines)`,
          line: fn.startLine,
          suggestion: 'Functions should ideally be under 30-40 lines',
        });
      }

      if (fn.parameters > 5) {
        issues.push({
          severity: 'warning',
          category: 'complexity',
          message: `Function "${fn.name}" has too many parameters (${fn.parameters})`,
          line: fn.startLine,
          suggestion: 'Consider using an options object or breaking down the function',
        });
      }

      if (fn.complexity > 10) {
        issues.push({
          severity: 'warning',
          category: 'complexity',
          message: `Function "${fn.name}" has high complexity (${fn.complexity})`,
          line: fn.startLine,
          suggestion: 'Reduce branches and nested conditions',
        });
      }
    }

    // Check for cognitive complexity indicators
    const cognitiveIssues = this.checkCognitiveComplexity(code);
    issues.push(...cognitiveIssues);

    return {
      issues,
      metrics: {
        cyclomaticComplexity: complexity,
        functionCount: functionMetrics.length,
        averageFunctionLength: functionMetrics.length > 0
          ? functionMetrics.reduce((sum, fn) => sum + fn.lines, 0) / functionMetrics.length
          : 0,
      },
    };
  }

  /**
   * Calculate cyclomatic complexity
   */
  calculateComplexity(code: string): number {
    let complexity = 1; // Base complexity

    // Decision points that increase complexity
    const patterns = [
      /\bif\b/g,
      /\belse\s+if\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /\?\s*[^:]/g,  // Ternary operator
      /&&/g,
      /\|\|/g,
      /\?\?/g,       // Nullish coalescing
    ];

    for (const pattern of patterns) {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  /**
   * Analyze individual functions in the code
   */
  private analyzeFunctions(code: string): Array<{
    name: string;
    startLine: number;
    lines: number;
    parameters: number;
    complexity: number;
  }> {
    const functions: Array<{
      name: string;
      startLine: number;
      lines: number;
      parameters: number;
      complexity: number;
    }> = [];

    // Match function declarations and expressions
    const functionPatterns = [
      // Named function declarations
      /function\s+(\w+)\s*\(([^)]*)\)\s*{/g,
      // Arrow functions assigned to variables
      /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g,
      // Method definitions
      /(\w+)\s*\(([^)]*)\)\s*{/g,
      // Async functions
      /async\s+function\s+(\w+)\s*\(([^)]*)\)\s*{/g,
    ];

    const lines = code.split('\n');

    for (const pattern of functionPatterns) {
      let match;
      pattern.lastIndex = 0;

      while ((match = pattern.exec(code)) !== null) {
        const name = match[1] || 'anonymous';
        const params = match[2] || '';
        const startIndex = match.index;
        const startLine = code.slice(0, startIndex).split('\n').length;

        // Count parameters
        const parameters = params.trim()
          ? params.split(',').filter(p => p.trim()).length
          : 0;

        // Find function body and calculate metrics
        const bodyStart = code.indexOf('{', match.index);
        if (bodyStart === -1) continue;

        const bodyEnd = this.findMatchingBrace(code, bodyStart);
        if (bodyEnd === -1) continue;

        const functionBody = code.slice(bodyStart, bodyEnd + 1);
        const functionLines = functionBody.split('\n').length;
        const complexity = this.calculateComplexity(functionBody);

        // Avoid duplicates
        if (!functions.some(f => f.name === name && f.startLine === startLine)) {
          functions.push({
            name,
            startLine,
            lines: functionLines,
            parameters,
            complexity,
          });
        }
      }
    }

    return functions;
  }

  /**
   * Find the matching closing brace
   */
  private findMatchingBrace(code: string, startIndex: number): number {
    let depth = 0;
    let inString = false;
    let stringChar = '';

    for (let i = startIndex; i < code.length; i++) {
      const char = code[i];
      const prevChar = code[i - 1];

      // Handle strings
      if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
        continue;
      }

      if (inString) continue;

      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          return i;
        }
      }
    }

    return -1;
  }

  /**
   * Check for cognitive complexity issues
   */
  private checkCognitiveComplexity(code: string): AnalysisIssue[] {
    const issues: AnalysisIssue[] = [];
    const lines = code.split('\n');

    // Check for deeply nested ternaries
    const nestedTernaries = code.match(/\?[^:]*\?/g);
    if (nestedTernaries && nestedTernaries.length > 0) {
      issues.push({
        severity: 'warning',
        category: 'complexity',
        message: 'Nested ternary operators detected - reduces readability',
        suggestion: 'Consider using if-else statements or extracting to a function',
      });
    }

    // Check for long chains
    const longChains = code.match(/\.\w+\([^)]*\)\.\w+\([^)]*\)\.\w+\([^)]*\)\.\w+/g);
    if (longChains && longChains.length > 0) {
      issues.push({
        severity: 'info',
        category: 'complexity',
        message: 'Long method chains detected',
        suggestion: 'Consider breaking into intermediate variables for debugging',
      });
    }

    // Check for complex boolean expressions
    lines.forEach((line, index) => {
      const booleanOps = (line.match(/&&|\|\|/g) || []).length;
      if (booleanOps > 3) {
        issues.push({
          severity: 'warning',
          category: 'complexity',
          message: 'Complex boolean expression',
          line: index + 1,
          suggestion: 'Extract conditions into well-named variables or functions',
        });
      }
    });

    // Check for switch statements without default
    const switchWithoutDefault = code.match(/switch\s*\([^)]*\)\s*{(?:(?!default:)[^}])*}/gs);
    if (switchWithoutDefault && switchWithoutDefault.length > 0) {
      issues.push({
        severity: 'info',
        category: 'complexity',
        message: 'Switch statement without default case',
        suggestion: 'Add a default case to handle unexpected values',
      });
    }

    return issues;
  }
}
