# Multi-stage Dockerfile for Next.js with standalone output
# Optimized for production deployment with minimal image size

# Stage 1: Dependencies
FROM node:26-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (includes devDeps for build)
RUN npm install

# Stage 2: Builder
FROM node:26-alpine AS builder
WORKDIR /app
# Install required libs for Prisma engines
RUN apk add --no-cache libc6-compat openssl

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy all source files
COPY . .

# Generate Prisma client
RUN npm run db:generate

# Build the Next.js application (standalone)
# This creates the standalone output in .next/standalone
# Skip env validation during build and provide dummy DATABASE_URL for Prisma
ENV SKIP_ENV_VALIDATION=true
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
# NEXT_PUBLIC_* values are inlined into the client bundle at build time
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
# Cap the build heap. The build host has 8Gi and NO swap; `next build --webpack`
# (heavy deps) spiked past available memory alongside the running containers and
# the OOM killer restarted all of them (2026-07-06). Bounding the heap keeps
# build + running containers under 8Gi. Raise if the build hits a heap OOM.
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# Stage 3: Runner (Production)
FROM node:26-alpine AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# openssh-client: the app generates the deploy SSH key (ssh-keygen) and the ws
# process (same image) runs remote `docker compose` deploys over ssh.
RUN apk add --no-cache openssh-client

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Copy standalone output
# The standalone output includes only necessary files for running the app
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema and generated client (needed at runtime)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Copy entrypoint for secrets handling via *_FILE
COPY --from=builder /app/docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && chown nextjs:nodejs /entrypoint.sh

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Set port environment variable
ENV PORT=3000
ENV HOSTNAME="*******"

# Health check
# Checks the health endpoint every 30 seconds
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => { process.exit(1); });"

# Start the application via entrypoint (loads secrets from *_FILE then execs server)
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]
