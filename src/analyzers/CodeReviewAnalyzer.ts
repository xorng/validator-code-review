/**
 * Issue found during analysis
 */
export interface AnalysisIssue {
  severity: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  line?: number;
  column?: number;
  suggestion?: string;
}

/**
 * Result from an analyzer
 */
export interface AnalysisResult {
  issues: AnalysisIssue[];
  metrics?: Record<string, number>;
}

/**
 * Code Review Analyzer - Analyzes code for general quality issues
 */
export class CodeReviewAnalyzer {
  private patterns: Array<{
    pattern: RegExp;
    severity: 'error' | 'warning' | 'info';
    category: string;
    message: string;
    suggestion?: string;
  }> = [];

  constructor() {
    this.initializePatterns();
  }

  private initializePatterns(): void {
    // Security patterns
    this.patterns.push({
      pattern: /eval\s*\(/gi,
      severity: 'error',
      category: 'security',
      message: 'Avoid using eval() - it can execute arbitrary code',
      suggestion: 'Use JSON.parse() for JSON data or safer alternatives',
    });

    this.patterns.push({
      pattern: /innerHTML\s*=/gi,
      severity: 'warning',
      category: 'security',
      message: 'innerHTML can lead to XSS vulnerabilities',
      suggestion: 'Use textContent or sanitize input before using innerHTML',
    });

    this.patterns.push({
      pattern: /document\.write/gi,
      severity: 'warning',
      category: 'security',
      message: 'document.write() is considered bad practice',
      suggestion: 'Use DOM manipulation methods instead',
    });

    // Code quality patterns
    this.patterns.push({
      pattern: /console\.(log|debug|info)\s*\(/gi,
      severity: 'info',
      category: 'code-quality',
      message: 'Console statement found - remove before production',
    });

    this.patterns.push({
      pattern: /debugger\s*;?/gi,
      severity: 'warning',
      category: 'code-quality',
      message: 'Debugger statement found - should be removed',
    });

    this.patterns.push({
      pattern: /TODO|FIXME|HACK|XXX/gi,
      severity: 'info',
      category: 'code-quality',
      message: 'Code comment marker found - may need attention',
    });

    // Error handling patterns
    this.patterns.push({
      pattern: /catch\s*\(\s*\w*\s*\)\s*{\s*}/gi,
      severity: 'warning',
      category: 'error-handling',
      message: 'Empty catch block - errors should be handled or logged',
    });

    this.patterns.push({
      pattern: /catch\s*\(\s*\w*\s*\)\s*{\s*\/\/.*\s*}/gi,
      severity: 'info',
      category: 'error-handling',
      message: 'Catch block only contains comments - consider proper error handling',
    });

    // Performance patterns
    this.patterns.push({
      pattern: /\.\s*forEach\s*\(\s*async/gi,
      severity: 'warning',
      category: 'performance',
      message: 'forEach with async callback - use for...of or Promise.all instead',
      suggestion: 'Use for...of loop or await Promise.all(array.map(async ...))',
    });

    // Best practices
    this.patterns.push({
      pattern: /==(?!=)/g,
      severity: 'info',
      category: 'best-practice',
      message: 'Use === instead of == for strict equality',
    });

    this.patterns.push({
      pattern: /!=(?!=)/g,
      severity: 'info',
      category: 'best-practice',
      message: 'Use !== instead of != for strict inequality',
    });

    this.patterns.push({
      pattern: /new\s+Array\s*\(/gi,
      severity: 'info',
      category: 'best-practice',
      message: 'Prefer array literal [] over new Array()',
    });

    this.patterns.push({
      pattern: /new\s+Object\s*\(/gi,
      severity: 'info',
      category: 'best-practice',
      message: 'Prefer object literal {} over new Object()',
    });

    // Potential bugs
    this.patterns.push({
      pattern: /=\s*=\s*=/g,
      severity: 'error',
      category: 'bug',
      message: 'Triple equals typo - possibly meant === or ==',
    });

    this.patterns.push({
      pattern: /if\s*\([^)]*=(?!=)[^)]*\)/g,
      severity: 'warning',
      category: 'bug',
      message: 'Assignment in conditional - possibly meant ==',
    });
  }

  /**
   * Analyze code for issues
   */
  async analyze(code: string, _context: string): Promise<AnalysisResult> {
    const issues: AnalysisIssue[] = [];
    const lines = code.split('\n');

    // Check each pattern
    for (const { pattern, severity, category, message, suggestion } of this.patterns) {
      // Reset regex state
      pattern.lastIndex = 0;
      
      let match;
      while ((match = pattern.exec(code)) !== null) {
        // Find line number
        const beforeMatch = code.slice(0, match.index);
        const lineNumber = beforeMatch.split('\n').length;

        issues.push({
          severity,
          category,
          message,
          line: lineNumber,
          suggestion,
        });
      }
    }

    // Check for very long lines
    lines.forEach((line, index) => {
      if (line.length > 120) {
        issues.push({
          severity: 'info',
          category: 'style',
          message: `Line exceeds 120 characters (${line.length})`,
          line: index + 1,
        });
      }
    });

    // Check for deeply nested code
    const maxIndent = this.checkNestingDepth(code);
    if (maxIndent > 4) {
      issues.push({
        severity: 'warning',
        category: 'complexity',
        message: `Deep nesting detected (${maxIndent} levels) - consider refactoring`,
        suggestion: 'Extract nested logic into separate functions',
      });
    }

    return { issues };
  }

  /**
   * Check the maximum nesting depth in the code
   */
  private checkNestingDepth(code: string): number {
    let maxDepth = 0;
    let currentDepth = 0;

    for (const char of code) {
      if (char === '{' || char === '(' || char === '[') {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      } else if (char === '}' || char === ')' || char === ']') {
        currentDepth = Math.max(0, currentDepth - 1);
      }
    }

    return maxDepth;
  }
}
