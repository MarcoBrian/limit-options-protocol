FROM node:18-alpine

# Set working directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S backend -u 1001

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install dependencies
RUN npm ci --only=production
WORKDIR /app/backend
RUN npm ci --only=production

# Go back to app root
WORKDIR /app

# Copy application code
COPY backend/ ./backend/
COPY scripts/ ./scripts/
COPY .env.example ./

# Create data directory for SQLite
RUN mkdir -p ./data && chown -R nodejs:nodejs ./data

# Create logs directory
RUN mkdir -p ./logs && chown -R nodejs:nodejs ./logs

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["npm", "start"]