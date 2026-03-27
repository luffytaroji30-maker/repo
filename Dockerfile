# ============================================================
# Velocity Proxy + Panel — Railway Dockerfile
# ============================================================

# ---- Stage 1: Build React Frontend ----
FROM node:20-alpine AS frontend-build
WORKDIR /build
COPY mineproxy-hub-main/package.json mineproxy-hub-main/package-lock.json* ./
RUN npm install
COPY mineproxy-hub-main/ ./
RUN npm run build

# ---- Stage 2: Runtime ----
FROM eclipse-temurin:17-jre-alpine

LABEL maintainer="BedWars Proxy" \
      description="Velocity Proxy with Web Panel"

ENV MEMORY="2G" \
    TZ=Asia/Singapore

# Install runtime dependencies
RUN apk add --no-cache bash curl ca-certificates nodejs npm

# Create non-root user
RUN adduser -D -h /proxy -s /bin/bash velocity && \
    mkdir -p /proxy/panel /data/plugins /data/logs && \
    chown -R velocity:velocity /proxy /data

WORKDIR /proxy

# Download Velocity JAR
ARG VELOCITY_VERSION=3.4.0
ARG VELOCITY_BUILD=466
RUN curl -fsSL "https://api.papermc.io/v2/projects/velocity/versions/${VELOCITY_VERSION}-SNAPSHOT/builds/${VELOCITY_BUILD}/downloads/velocity-${VELOCITY_VERSION}-SNAPSHOT-${VELOCITY_BUILD}.jar" \
    -o /proxy/velocity.jar && \
    chown velocity:velocity /proxy/velocity.jar

# Copy proxy configs
COPY --chown=velocity:velocity velocity.toml /proxy/velocity.toml
COPY --chown=velocity:velocity forwarding.secret /proxy/forwarding.secret

# Copy and install panel backend
COPY --chown=velocity:velocity panel/package.json panel/package-lock.json* /proxy/panel/
RUN cd /proxy/panel && npm install --production && chown -R velocity:velocity /proxy/panel

COPY --chown=velocity:velocity panel/server.js /proxy/panel/server.js

# Copy built React frontend from stage 1
COPY --from=frontend-build --chown=velocity:velocity /build/dist /proxy/panel/public

# Copy startup scripts
COPY --chown=velocity:velocity start.sh /proxy/start.sh
RUN chmod +x /proxy/start.sh

# Build version marker
RUN echo "build-$(date +%s)" > /proxy/.image-version

# Expose ports
EXPOSE 25577 3000

# Entrypoint
COPY --chown=root:root entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD bash -c 'echo > /dev/tcp/127.0.0.1/25577' 2>/dev/null || exit 1

ENTRYPOINT ["/entrypoint.sh"]
