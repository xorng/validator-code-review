# XORNG Code Review Validator

An MCP (Model Context Protocol) server that provides code review and quality analysis tools.

## Overview

This validator analyzes code for:
- **Quality Issues**: Security vulnerabilities, potential bugs, error handling
- **Style**: Formatting, consistency, best practices
- **Complexity**: Cyclomatic complexity, function length, nesting depth

## Installation

```bash
npm install
npm run build
```

## Usage

### As a standalone MCP server

```bash
npm start
```

The server communicates via stdio and implements the MCP protocol.

### With Docker

```bash
# Build the image
npm run docker:build

# Run the container
npm run docker:run
```

### With XORNG Core

```typescript
import { XORNGCore } from '@xorng/core';

const core = new XORNGCore();
await core.initialize();

await core.registerSubAgent({
  id: 'code-review',
  name: 'Code Reviewer',
  type: 'validator',
  description: 'Analyzes code for quality, style, and complexity issues',
  connectionType: 'stdio',
  command: 'node',
  args: ['path/to/validator-code-review/dist/index.js'],
  capabilities: ['code-analysis', 'style-check', 'complexity-analysis'],
});
```

## Available Tools

### `process`

Main entry point for processing code review requests.

**Input:**
```typescript
{
  prompt: string;     // The review request
  context?: {
    projectPath?: string;
    currentFile?: string;
    selectedCode?: string;
    recentFiles?: string[];
  };
}
```

**Output:**
```typescript
{
  result: string;     // Summary of the review
  confidence: number; // 0-1 confidence score
  issues: Array<{
    severity: 'error' | 'warning' | 'info';
    message: string;
    line?: number;
  }>;
}
```

### `analyze-code`

Analyze code for quality issues.

**Input:**
```typescript
{
  code: string;       // Code to analyze
  language?: string;  // Programming language
  focus?: 'quality' | 'style' | 'complexity' | 'all';
}
```

**Output:**
```typescript
{
  issues: Array<{
    severity: 'error' | 'warning' | 'info';
    category: string;
    message: string;
    line?: number;
    suggestion?: string;
  }>;
  metrics: {
    linesOfCode: number;
    complexity: number;
    maintainability: number;
  };
  summary: string;
}
```

### `review-changes`

Review code diffs for potential issues.

**Input:**
```typescript
{
  diff: string;       // Git diff to review
  context?: string;   // Additional context
}
```

**Output:**
```typescript
{
  approved: boolean;
  comments: Array<{
    line: number;
    type: 'suggestion' | 'issue' | 'question';
    content: string;
  }>;
  summary: string;
}
```

### `suggest-improvements`

Generate improvement suggestions for code.

**Input:**
```typescript
{
  code: string;
  goals?: string[];   // Specific improvement goals
}
```

**Output:**
```typescript
{
  suggestions: Array<{
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    codeExample?: string;
  }>;
}
```

## Analyzers

### CodeReviewAnalyzer

Checks for:
- Security issues (eval, innerHTML, document.write)
- Console statements and debugger
- Empty catch blocks
- Potential bugs (assignment in conditionals)
- Best practices (strict equality, array/object literals)

### StyleAnalyzer

Checks for:
- Consistent indentation (tabs vs spaces)
- Trailing whitespace
- Quote style consistency
- Missing semicolons
- Operator spacing
- Blank line usage

### ComplexityAnalyzer

Checks for:
- Cyclomatic complexity
- Function length and parameter count
- Nesting depth
- Cognitive complexity (nested ternaries, long chains)

## Development

```bash
# Build
npm run build

# Watch mode
npm run dev

# Run tests
npm test

# Lint
npm run lint
```

## Docker

### Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/

ENTRYPOINT ["node", "dist/index.js"]
```

### Build and run

```bash
docker build -t xorng/validator-code-review .
docker run -i xorng/validator-code-review
```

## License

MIT
