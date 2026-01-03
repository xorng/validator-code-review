#!/usr/bin/env node
/**
 * XORNG Code Review Validator
 * 
 * An MCP server that provides code review and quality analysis tools.
 * Designed to run in Docker containers for isolation.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod';
import { CodeReviewAnalyzer } from './analyzers/CodeReviewAnalyzer.js';
import { StyleAnalyzer } from './analyzers/StyleAnalyzer.js';
import { ComplexityAnalyzer } from './analyzers/ComplexityAnalyzer.js';

// Initialize analyzers
const codeReviewAnalyzer = new CodeReviewAnalyzer();
const styleAnalyzer = new StyleAnalyzer();
const complexityAnalyzer = new ComplexityAnalyzer();

// Create MCP server
const server = new McpServer({
  name: 'xorng-validator-code-review',
  version: '0.1.0',
});

// Register the main process tool (required by XORNG Core)
server.registerTool(
  'process',
  {
    title: 'Process Request',
    description: 'Main entry point for processing code review requests',
    inputSchema: {
      prompt: z.string().describe('The review request or question'),
      context: z.object({
        projectPath: z.string().optional(),
        currentFile: z.string().optional(),
        selectedCode: z.string().optional(),
        recentFiles: z.array(z.string()).optional(),
      }).optional().describe('Additional context for the review'),
    },
    outputSchema: {
      result: z.string(),
      confidence: z.number(),
      issues: z.array(z.object({
        severity: z.enum(['error', 'warning', 'info']),
        message: z.string(),
        line: z.number().optional(),
      })),
    },
  },
  async ({ prompt, context }) => {
    const code = context?.selectedCode || '';
    const file = context?.currentFile || 'unknown';
    
    // Analyze the code
    const reviewResults = await codeReviewAnalyzer.analyze(code, prompt);
    const styleResults = await styleAnalyzer.analyze(code);
    const complexityResults = await complexityAnalyzer.analyze(code);
    
    // Combine results
    const allIssues = [
      ...reviewResults.issues,
      ...styleResults.issues,
      ...complexityResults.issues,
    ];
    
    // Generate summary
    const summary = generateSummary(allIssues, file, reviewResults, styleResults, complexityResults);
    
    const output = {
      result: summary,
      confidence: calculateConfidence(allIssues),
      issues: allIssues,
    };
    
    return {
      content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
      structuredContent: output,
    };
  }
);

// Register code analysis tool
server.registerTool(
  'analyze-code',
  {
    title: 'Analyze Code',
    description: 'Analyze code for quality issues, patterns, and improvements',
    inputSchema: {
      code: z.string().describe('The code to analyze'),
      language: z.string().optional().describe('Programming language'),
      focus: z.enum(['quality', 'style', 'complexity', 'all']).optional()
        .describe('Focus area for analysis'),
    },
    outputSchema: {
      issues: z.array(z.object({
        severity: z.enum(['error', 'warning', 'info']),
        category: z.string(),
        message: z.string(),
        line: z.number().optional(),
        suggestion: z.string().optional(),
      })),
      metrics: z.object({
        linesOfCode: z.number(),
        complexity: z.number(),
        maintainability: z.number(),
      }),
      summary: z.string(),
    },
  },
  async ({ code, language, focus }) => {
    const analysisPromise = [];
    
    if (focus === 'all' || focus === 'quality' || !focus) {
      analysisPromise.push(codeReviewAnalyzer.analyze(code, ''));
    }
    if (focus === 'all' || focus === 'style' || !focus) {
      analysisPromise.push(styleAnalyzer.analyze(code));
    }
    if (focus === 'all' || focus === 'complexity' || !focus) {
      analysisPromise.push(complexityAnalyzer.analyze(code));
    }
    
    const results = await Promise.all(analysisPromise);
    const allIssues = results.flatMap(r => r.issues);
    
    const metrics = {
      linesOfCode: code.split('\n').length,
      complexity: complexityAnalyzer.calculateComplexity(code),
      maintainability: calculateMaintainability(allIssues, code),
    };
    
    const output = {
      issues: allIssues,
      metrics,
      summary: `Found ${allIssues.length} issues. Complexity: ${metrics.complexity}, Maintainability: ${metrics.maintainability}/100`,
    };
    
    return {
      content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
      structuredContent: output,
    };
  }
);

// Register review-specific tool
server.registerTool(
  'review-changes',
  {
    title: 'Review Code Changes',
    description: 'Review code changes (diff) for potential issues',
    inputSchema: {
      diff: z.string().describe('The code diff to review'),
      context: z.string().optional().describe('Additional context about the changes'),
    },
    outputSchema: {
      approved: z.boolean(),
      comments: z.array(z.object({
        line: z.number(),
        type: z.enum(['suggestion', 'issue', 'question']),
        content: z.string(),
      })),
      summary: z.string(),
    },
  },
  async ({ diff, context }) => {
    const comments = analyzeDiff(diff);
    const hasBlockingIssues = comments.some(c => c.type === 'issue');
    
    const output = {
      approved: !hasBlockingIssues,
      comments,
      summary: hasBlockingIssues 
        ? `Found ${comments.filter(c => c.type === 'issue').length} blocking issues that should be addressed.`
        : `Changes look good. ${comments.length} minor suggestions.`,
    };
    
    return {
      content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
      structuredContent: output,
    };
  }
);

// Register suggest-improvements tool
server.registerTool(
  'suggest-improvements',
  {
    title: 'Suggest Improvements',
    description: 'Suggest specific improvements for the given code',
    inputSchema: {
      code: z.string().describe('The code to improve'),
      goals: z.array(z.string()).optional().describe('Specific improvement goals'),
    },
    outputSchema: {
      suggestions: z.array(z.object({
        title: z.string(),
        description: z.string(),
        priority: z.enum(['high', 'medium', 'low']),
        codeExample: z.string().optional(),
      })),
    },
  },
  async ({ code, goals }) => {
    const suggestions = generateImprovementSuggestions(code, goals || []);
    
    const output = { suggestions };
    
    return {
      content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
      structuredContent: output,
    };
  }
);

// Helper functions
function generateSummary(
  issues: Array<{ severity: string; message: string }>,
  file: string,
  _reviewResults: { issues: unknown[] },
  _styleResults: { issues: unknown[] },
  _complexityResults: { issues: unknown[] }
): string {
  const errors = issues.filter(i => i.severity === 'error').length;
  const warnings = issues.filter(i => i.severity === 'warning').length;
  const infos = issues.filter(i => i.severity === 'info').length;
  
  let summary = `Code Review Results for ${file}\n`;
  summary += `=====================================\n\n`;
  summary += `Found ${issues.length} total issues:\n`;
  summary += `- ${errors} errors\n`;
  summary += `- ${warnings} warnings\n`;
  summary += `- ${infos} informational\n\n`;
  
  if (errors > 0) {
    summary += `Critical Issues:\n`;
    issues.filter(i => i.severity === 'error').forEach(i => {
      summary += `  ❌ ${i.message}\n`;
    });
    summary += '\n';
  }
  
  if (warnings > 0) {
    summary += `Warnings:\n`;
    issues.filter(i => i.severity === 'warning').forEach(i => {
      summary += `  ⚠️ ${i.message}\n`;
    });
  }
  
  return summary;
}

function calculateConfidence(issues: Array<{ severity: string }>): number {
  const errors = issues.filter(i => i.severity === 'error').length;
  const warnings = issues.filter(i => i.severity === 'warning').length;
  
  // Higher confidence with fewer issues
  const baseConfidence = 0.9;
  const penalty = (errors * 0.1) + (warnings * 0.02);
  
  return Math.max(0.5, baseConfidence - penalty);
}

function calculateMaintainability(issues: Array<{ severity: string }>, code: string): number {
  const baseScore = 100;
  const errors = issues.filter(i => i.severity === 'error').length;
  const warnings = issues.filter(i => i.severity === 'warning').length;
  const linesOfCode = code.split('\n').length;
  
  // Penalize for issues and excessive length
  let score = baseScore;
  score -= errors * 10;
  score -= warnings * 3;
  score -= Math.max(0, (linesOfCode - 100) * 0.1);
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

function analyzeDiff(diff: string): Array<{ line: number; type: 'suggestion' | 'issue' | 'question'; content: string }> {
  const comments: Array<{ line: number; type: 'suggestion' | 'issue' | 'question'; content: string }> = [];
  const lines = diff.split('\n');
  
  let currentLine = 0;
  
  for (const line of lines) {
    currentLine++;
    
    // Check for common issues in added lines
    if (line.startsWith('+') && !line.startsWith('+++')) {
      const content = line.slice(1);
      
      if (content.includes('console.log')) {
        comments.push({
          line: currentLine,
          type: 'suggestion',
          content: 'Consider removing console.log before committing',
        });
      }
      
      if (content.includes('TODO') || content.includes('FIXME')) {
        comments.push({
          line: currentLine,
          type: 'question',
          content: 'Should this TODO/FIXME be addressed before merging?',
        });
      }
      
      if (content.includes('password') || content.includes('secret') || content.includes('api_key')) {
        comments.push({
          line: currentLine,
          type: 'issue',
          content: 'Potential sensitive data exposure. Review carefully.',
        });
      }
    }
  }
  
  return comments;
}

function generateImprovementSuggestions(
  code: string,
  goals: string[]
): Array<{ title: string; description: string; priority: 'high' | 'medium' | 'low'; codeExample?: string }> {
  const suggestions: Array<{ title: string; description: string; priority: 'high' | 'medium' | 'low'; codeExample?: string }> = [];
  
  // Check for common improvement opportunities
  if (code.includes('var ')) {
    suggestions.push({
      title: 'Use const/let instead of var',
      description: 'Modern JavaScript uses const and let for variable declarations. This provides better scoping and prevents accidental reassignment.',
      priority: 'medium',
      codeExample: '// Instead of: var x = 1;\n// Use: const x = 1; // or let x = 1;',
    });
  }
  
  if (code.includes('function') && !code.includes('=>')) {
    suggestions.push({
      title: 'Consider arrow functions',
      description: 'Arrow functions provide a more concise syntax and lexically bind this.',
      priority: 'low',
    });
  }
  
  if (code.split('\n').length > 50) {
    suggestions.push({
      title: 'Consider breaking into smaller functions',
      description: 'Large functions can be difficult to understand and test. Consider extracting logical sections into separate functions.',
      priority: 'medium',
    });
  }
  
  if (!code.includes('try') && (code.includes('fetch') || code.includes('await'))) {
    suggestions.push({
      title: 'Add error handling',
      description: 'Async operations should have proper error handling to prevent unhandled promise rejections.',
      priority: 'high',
      codeExample: 'try {\n  const result = await fetchData();\n} catch (error) {\n  console.error("Failed:", error);\n}',
    });
  }
  
  // Add goal-specific suggestions
  for (const goal of goals) {
    if (goal.toLowerCase().includes('performance')) {
      suggestions.push({
        title: 'Performance optimization review',
        description: 'Consider memoization, lazy loading, and avoiding unnecessary re-renders.',
        priority: 'medium',
      });
    }
    if (goal.toLowerCase().includes('security')) {
      suggestions.push({
        title: 'Security hardening',
        description: 'Review input validation, sanitization, and secure data handling practices.',
        priority: 'high',
      });
    }
  }
  
  return suggestions;
}

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Keep the process running
  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
