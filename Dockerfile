FROM node:20-alpine AS builder

WORKDIR /workspace

# Copy entire workspace for monorepo dependency resolution
COPY . .

# Build the template dependencies first
WORKDIR /workspace/template-base
RUN npm ci && npm run build

WORKDIR /workspace/template-validator  
RUN npm ci && npm run build

# Build this service
WORKDIR /workspace/validator-code-review
RUN npm ci && npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY --from=builder /workspace/validator-code-review/package*.json ./

# Copy built template dependencies into node_modules
COPY --from=builder /workspace/template-base /app/node_modules/@xorng/template-base
COPY --from=builder /workspace/template-validator /app/node_modules/@xorng/template-validator

# Install only external production dependencies
RUN npm ci --omit=dev --ignore-scripts 2>/dev/null || npm install --omit=dev --ignore-scripts 2>/dev/null || true

# Copy built files
COPY --from=builder /workspace/validator-code-review/dist ./dist/

# Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Start the MCP server
ENTRYPOINT ["node", "dist/index.js"]
