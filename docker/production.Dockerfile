# Production Dockerfile for Stapelwerk AI Recommendations
# Optimized for security, performance, and minimal attack surface

# Use Node.js LTS with Alpine for minimal image size and security
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /usr/src/app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production && npm cache clean --force

# Remove build dependencies to reduce image size
RUN apk del python3 make g++

# Copy application code
COPY . .

# Build the application (if needed)
RUN npm run build 2>/dev/null || echo "No build script found"

# Remove development files
RUN rm -rf .git .github docs tests *.md || true

# ============================================================================
# Production Stage
# ============================================================================

FROM node:18-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S stapelwerk -u 1001

# Install production runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /usr/src/app

# Copy application from builder stage
COPY --from=builder --chown=stapelwerk:nodejs /usr/src/app/node_modules ./node_modules
COPY --from=builder --chown=stapelwerk:nodejs /usr/src/app/package*.json ./
COPY --from=builder --chown=stapelwerk:nodejs /usr/src/app/dist ./dist 2>/dev/null || echo "No dist directory"
COPY --from=builder --chown=stapelwerk:nodejs /usr/src/app/src ./src
COPY --from=builder --chown=stapelwerk:nodejs /usr/src/app/*.js ./

# Create required directories
RUN mkdir -p /usr/src/app/logs && \
    chown -R stapelwerk:nodejs /usr/src/app/logs

# Switch to non-root user
USER stapelwerk

# Expose application port
EXPOSE 8080

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Set default environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV HEALTH_CHECK_PATH=/health

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "src/app.js"]