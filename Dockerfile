FROM node:20-alpine AS web-builder

# Build Next.js frontend
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# Final stage: PocketBase + built Next.js
FROM alpine:latest

# Install ca-certificates for HTTPS, and supervisord to run both processes
RUN apk add --no-cache ca-certificates supervisor

# Download PocketBase v0.35.0 (adjust version/arch as needed)
ARG PB_VERSION=0.35.0
ARG PB_ARCH=amd64
RUN wget -O /tmp/pb.zip https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${PB_ARCH}.zip \
    && unzip /tmp/pb.zip -d /pb \
    && chmod +x /pb/pocketbase \
    && rm /tmp/pb.zip

# Copy Next.js build and node runtime
WORKDIR /app/web
COPY --from=web-builder /app/web/.next ./.next
COPY --from=web-builder /app/web/public ./public
COPY --from=web-builder /app/web/package*.json ./
COPY --from=web-builder /app/web/node_modules ./node_modules

# Copy PocketBase migrations and hooks
COPY pocketbase/pb_migrations /pb/pb_migrations
COPY pocketbase/pb_hooks /pb/pb_hooks

# supervisord config
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Expose ports: Next.js (3000), PocketBase (8090)
EXPOSE 3000 8090

# Volume for PocketBase data persistence
VOLUME /pb/pb_data

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]

