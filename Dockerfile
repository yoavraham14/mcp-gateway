# Shared image for every MCP server under servers/.
# Each server is installed and built here; supergateway (the stdio -> HTTP
# bridge) is installed globally and invoked per-service from docker-compose.yml
# (or via the default CMD below when deployed as a single service, e.g. Render).

FROM node:22-slim

WORKDIR /app

# Bring in every MCP server
COPY servers/ ./servers/

# Install dependencies and build each server that ships a build script
RUN set -eux; \
    for dir in servers/*/; do \
      [ -f "${dir}package.json" ] || continue; \
      cd "$dir"; \
      if [ -f package-lock.json ]; then npm ci; else npm install; fi; \
      npm run build --if-present; \
      cd /app; \
    done

# stdio -> HTTP bridge, shared by all servers
RUN npm install -g supergateway

# docker-compose overrides `command` per service; this default runs the
# remote-rocketship server on $PORT (Render injects PORT; falls back to 8001).
# streamableHttp exposes a single MCP endpoint at /mcp (what Claude custom
# connectors expect); use --outputTransport sse instead for SSE-only clients.
ENV PORT=8001
EXPOSE 8001

CMD ["sh", "-c", "supergateway --stdio \"node servers/remote-rocketship/dist/index.js\" --outputTransport streamableHttp --port ${PORT} --healthEndpoint /healthz --cors"]
