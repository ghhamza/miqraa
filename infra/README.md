# Miqraa Infrastructure

Docker-compose services that run alongside the Rust backend in development.

## LiveKit (media server)

LiveKit handles all WebRTC media (audio + video SFU) for Miqraa live sessions. The Rust backend is the source of truth for rooms, auth, and non-media events; it mints LiveKit access tokens and delegates media to LiveKit.

### Start LiveKit

```bash
cd infra
docker compose up -d livekit
```

### Stop LiveKit

```bash
cd infra
docker compose down
```

### Logs

```bash
docker compose logs -f livekit
```

### Dev credentials

LiveKit runs with the built-in dev key pair:

- `LIVEKIT_URL=ws://localhost:7880`
- `LIVEKIT_API_KEY=devkey`
- `LIVEKIT_API_SECRET=secret`

These are **dev-only** values hardcoded by LiveKit's `--dev` flag. They are **not secrets** - they are the documented defaults. Production will use real generated keys (see P7).

### Ports

| Port | Protocol | Purpose |
|-----------|----------|--------------------------------------------|
| 7880 | TCP | WebSocket signaling (client <-> LiveKit) |
| 7881 | TCP | WebRTC over TCP (fallback) |
| 7882 | UDP | WebRTC media (primary path, dev) |

### Verify it works

After `docker compose up -d livekit`:

```bash
# HTTP probe - should respond (LiveKit's signal server answers on 7880)
curl -i http://localhost:7880

# Check container is healthy
docker compose ps
```

Expect `curl` to return a response (even an error body is fine - the point is that something is listening). `docker compose ps` should show `miqraa-livekit` as `running`.

### What's NOT here yet

- **Redis** - only needed for multi-node clustering. Single-node dev does not need it. Will be added when we actually scale (P7 or later).
- **Caddy / TLS** - production-only. Local dev uses plain `ws://`.
- **TURN over TLS** - production-only. Most dev networks don't need TURN at all; UDP 7882 is sufficient for localhost testing.
- **Egress** (recording) - separate service, added when recording is implemented.

See the official docs: https://docs.livekit.io/transport/self-hosting/
