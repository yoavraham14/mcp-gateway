# mcp-gateway

Wraps local **stdio** MCP servers with [`supergateway`](https://github.com/supercorp-ai/supergateway)
so they are reachable over **HTTP** (Streamable HTTP MCP) — from a cloud
scheduled task, a Custom Connector, or any remote MCP client — instead of only
from a desktop app on this machine.

```
mcp-gateway/
├── Dockerfile            # one image: builds every servers/*, installs supergateway
├── docker-compose.yml    # one service block per MCP server
├── .env.example          # env vars each server needs (copy to .env)
├── servers/
│   └── remote-rocketship/  # an unmodified stdio MCP server
└── README.md
```

Each server keeps its own code and dependencies under `servers/<name>/`. The
shared `Dockerfile` installs and builds all of them; `docker-compose.yml` starts
one `supergateway` process per server, each on its own port.

---

## Run locally

```bash
cd mcp-gateway
cp .env.example .env        # then edit .env and set the real keys
docker compose up --build
```

`remote-rocketship` is then served at:

| Endpoint | URL |
| --- | --- |
| MCP (Streamable HTTP) | `http://localhost:8001/mcp` |
| Health check | `http://localhost:8001/healthz` |

Quick check:

```bash
curl -i http://localhost:8001/healthz

# MCP initialize handshake (Streamable HTTP): expect HTTP 200 + a JSON-RPC result
curl -sN -X POST http://localhost:8001/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"0"}}}'
```

Stop with `Ctrl+C`, or `docker compose down`.

---

## Add another MCP server

1. **Drop the code in.** Put the server under `servers/<name>/` (e.g.
   `servers/my-thing/`). It must be a stdio MCP server with a `package.json`. If
   it needs a build step, keep its `build` script (the image runs
   `npm run build --if-present`); the launch command should point at the built
   entry file.

2. **Confirm its launch command.** Read the server's `package.json` — note
   whether it starts with `node dist/index.js`, `npm start`, `node server.js`,
   `python -m ...`, etc. That exact command goes in `--stdio`.

3. **Add a service block** to `docker-compose.yml` by copying the
   `remote-rocketship` block (a commented template is included there). Change:
   - the service name → `my-thing`
   - `--stdio "<launch command>"` → e.g. `--stdio "node servers/my-thing/dist/index.js"`
     (paths are relative to `/app` inside the image)
   - `--port` and the published `ports:` mapping → the next free port, e.g. `8002`
   - `environment:` → whatever env vars that server requires

   Leave `--outputTransport streamableHttp` as-is; the server's MCP endpoint is
   then `http://localhost:<port>/mcp`.

4. **Add its env vars** to `.env.example` and to your local `.env`.

5. **Rebuild and start.**

   ```bash
   docker compose up --build
   ```

That's it — no Dockerfile change is needed. The `Dockerfile` loops over every
directory in `servers/` and installs/builds each one.

> **Python (or other non-Node) servers:** the base image is `node:22-slim`. If
> you add a server with a different runtime, install that runtime in the
> `Dockerfile` before the build loop (e.g. `apt-get install -y python3`), or
> switch to per-server Dockerfiles.

---

## Deploy to Render (single service)

Render runs one container per web service and injects `$PORT`. The `Dockerfile`'s
default `CMD` already honours `$PORT` and launches the `remote-rocketship`
server, so no compose file is used on Render.

1. Push this directory to a GitHub repo.
2. Render → **New → Web Service** → connect the repo.
3. **Runtime: Docker.** Render auto-detects the `Dockerfile`.
4. **Environment variables:** add `RR_API_KEY` with the real value. (Do **not**
   commit `.env`.)
5. Deploy. Render gives a public URL like `https://<name>.onrender.com`; the MCP
   endpoint is `https://<name>.onrender.com/mcp` and health is
   `https://<name>.onrender.com/healthz` (set that as the Render health check
   path).

To run more than one server on Render, deploy each as its own web service. Set
its start command (Render → Settings → **Docker Command**) to that server's
supergateway invocation, for example:

```
supergateway --stdio "node servers/my-thing/dist/index.js" --outputTransport streamableHttp --port $PORT --healthEndpoint /healthz --cors
```

---

## Register with Claude as a Custom Connector

Once deployed, add the public MCP URL (`https://<name>.onrender.com/mcp`) as a
Custom Connector in Claude, with **authentication set to "None"** (the gateway
does not require sign-in). The wrapped tools — e.g.
`search_remote_rocketship_jobs` — then work from cloud scheduled tasks even when
this machine is off.
