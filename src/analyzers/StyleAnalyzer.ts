import type { AnalysisIssue, AnalysisResult } from './CodeReviewAnalyzer.js';

/**
 * Style Analyzer - Analyzes code for style and formatting issues
 */
export class StyleAnalyzer {
  /**
   * Analyze code for style issues
   */
  async analyze(code: string): Promise<AnalysisResult> {
    const issues: AnalysisIssue[] = [];
    const lines = code.split('\n');

    // Check for consistent indentation
    const indentIssues = this.checkIndentation(lines);
    issues.push(...indentIssues);

    // Check for trailing whitespace
    lines.forEach((line, index) => {
      if (line.endsWith(' ') || line.endsWith('\t')) {
        issues.push({
          severity: 'info',
          category: 'style',
          message: 'Trailing whitespace',
          line: index + 1,
        });
      }
    });

    // Check for inconsistent quotes
    const quoteIssues = this.checkQuotes(code, lines);
    issues.push(...quoteIssues);

    // Check for missing semicolons (JavaScript/TypeScript)
    const semicolonIssues = this.checkSemicolons(lines);
    issues.push(...semicolonIssues);

    // Check for spacing around operators
    const spacingIssues = this.checkOperatorSpacing(lines);
    issues.push(...spacingIssues);

    // Check for blank line usage
    const blankLineIssues = this.checkBlankLines(lines);
    issues.push(...blankLineIssues);

    return { issues };
  }

  /**
   * Check for consistent indentation
   */
  private checkIndentation(lines: string[]): AnalysisIssue[] {
    const issues: AnalysisIssue[] = [];
    let usesSpaces = false;
    let usesTabs = false;

    lines.forEach((line, index) => {
      if (line.length === 0) return;

      const leadingWhitespace = line.match(/^[\t ]*/)?.[0] || '';
      
      if (leadingWhitespace.includes('\t')) {
        usesTabs = true;
      }
      if (leadingWhitespace.includes(' ') && leadingWhitespace.length > 0) {
        usesSpaces = true;
      }

      // Check for mixed indentation on same line
      if (leadingWhitespace.includes('\t') && leadingWhitespace.includes(' ')) {
        issues.push({
          severity: 'warning',
          category: 'style',
          message: 'Mixed tabs and spaces in indentation',
          line: index + 1,
        });
      }
    });

    // Check for inconsistent indentation style
    if (usesSpaces && usesTabs) {
      issues.push({
        severity: 'warning',
        category: 'style',
        message: 'Inconsistent indentation style - file uses both tabs and spaces',
        suggestion: 'Use a consistent indentation style throughout the file',
      });
    }

    return issues;
  }

  /**
   * Check for consistent quote usage
   */
  private checkQuotes(code: string, lines: string[]): AnalysisIssue[] {
    const issues: AnalysisIssue[] = [];
    
    // Count single and double quotes (excluding escaped and template literals)
    let singleQuotes = 0;
    let doubleQuotes = 0;

    // Simple heuristic - count quotes at string boundaries
    const singleMatches = code.match(/'[^']*'/g) || [];
    const doubleMatches = code.match(/"[^"]*"/g) || [];

    singleQuotes = singleMatches.length;
    doubleQuotes = doubleMatches.length;

    // If both are used significantly, flag inconsistency
    if (singleQuotes > 5 && doubleQuotes > 5) {
      const dominant = singleQuotes > doubleQuotes ? 'single' : 'double';
      issues.push({
        severity: 'info',
        category: 'style',
        message: `Inconsistent quote usage - consider using ${dominant} quotes consistently`,
      });
    }

    return issues;
  }

  /**
   * Check for missing semicolons
   */
  private checkSemicolons(lines: string[]): AnalysisIssue[] {
    const issues: AnalysisIssue[] = [];
    
    // Patterns that should end with semicolons
    const shouldHaveSemicolon = /^(?!.*(?:if|else|for|while|function|class|switch|try|catch|finally|{|}|\)|\/\/|\/\*|\*\/|^\s*$)).*[^\s;{},]$/;
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      // Skip empty lines, comments, and structural elements
      if (!trimmed || 
          trimmed.startsWith('//') || 
          trimmed.startsWith('/*') ||
          trimmed.startsWith('*') ||
          trimmed.endsWith('{') ||
          trimmed.endsWith('}') ||
          trimmed.endsWith(',')) {
        return;
      }

      // Check for lines that look like statements but don't end with semicolon
      if (shouldHaveSemicolon.test(trimmed) && 
          !trimmed.endsWith(';') && 
          !trimmed.endsWith(':') &&
          !trimmed.includes('=>')) {
        // Only flag if it looks like a complete statement
        if (trimmed.includes('=') || 
            trimmed.includes('return') || 
            trimmed.includes('throw') ||
            trimmed.match(/\)\s*$/)) {
          issues.push({
            severity: 'info',
            category: 'style',
            message: 'Possible missing semicolon',
            line: index + 1,
          });
        }
      }
    });

    return issues;
  }

  /**
   * Check for proper spacing around operators
   */
  private checkOperatorSpacing(lines: string[]): AnalysisIssue[] {
    const issues: AnalysisIssue[] = [];
    
    const operatorPatterns = [
      { pattern: /[^\s]=(?!=)[^\s>]/g, message: 'Missing space around assignment operator' },
      { pattern: /[^\s+]\+\+/g, message: 'Consider spacing for readability' },
    ];

    lines.forEach((line, index) => {
      // Skip if line is a comment or string-heavy
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
        return;
      }

      for (const { pattern, message } of operatorPatterns) {
        pattern.lastIndex = 0;
        if (pattern.test(line)) {
          // Don't flag common patterns like ++ or object properties
          if (!line.includes('++') && !line.includes('--') && !line.includes(':')) {
            issues.push({
              severity: 'info',
              category: 'style',
              message,
              line: index + 1,
            });
          }
        }
      }
    });

    return issues;
  }

  /**
   * Check for proper blank line usage
   */
  private checkBlankLines(lines: string[]): AnalysisIssue[] {
    const issues: AnalysisIssue[] = [];
    let consecutiveBlankLines = 0;

    lines.forEach((line, index) => {
      if (line.trim() === '') {
        consecutiveBlankLines++;
        if (consecutiveBlankLines > 2) {
          issues.push({
            severity: 'info',
            category: 'style',
            message: 'Multiple consecutive blank lines',
            line: index + 1,
          });
        }
      } else {
        consecutiveBlankLines = 0;
      }
    });

    // Check for blank line at end of file
    if (lines.length > 0 && lines[lines.length - 1]?.trim() !== '') {
      issues.push({
        severity: 'info',
        category: 'style',
        message: 'File should end with a newline',
        line: lines.length,
      });
    }

    return issues;
  }
}
