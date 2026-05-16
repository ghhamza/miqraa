# Installing Maqraa (Self-Hosted, Manual)

This document describes a production-grade manual installation of Maqraa on a
**two-server** topology:

- **App server** — Rust backend + React frontend (static) + PostgreSQL 16 + Nginx
- **Media server** — LiveKit + Caddy (TLS), via Docker Compose

It mirrors a real deployment and includes the security hardening steps. If you
only want a local development setup, see `README.md` instead — this guide is for
running a hardened public instance.

> Throughout this guide, replace placeholders like `<APP_IP>`, `<APP_DOMAIN>`,
> `your@email.com`, and any generated secret with your own values. Never commit
> real secrets to a repository.

---

## 1. Prerequisites

- Two Linux servers (Ubuntu 24.04 LTS assumed). Suggested sizing:
  - **App server:** 4 vCPU / 8 GB RAM minimum. Rust release builds can OOM on
    4 GB — do not undersize this box.
  - **Media server:** 2 vCPU / 4 GB RAM is sufficient for ~50 concurrent
    participants.
- A domain you control, with the ability to set DNS A records.
- Two subdomains, e.g.:
  - `app.example.org` → app server
  - `livekit.example.org` → media server
- An SSH key pair on your local machine.
- If you put the servers behind a CDN/proxy (e.g. Cloudflare), the DNS records
  for both subdomains **must be DNS-only / unproxied**. A proxy in front of the
  servers will break WebRTC media and Let's Encrypt HTTP validation.

### Generate an SSH key (local machine)

```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_maqraa -N "" -C "maqraa-deploy"
cat ~/.ssh/id_maqraa.pub
```

Add this public key to **both** servers at provision time (most providers let
you attach an SSH key during creation). Do not enable password login.

### DNS

Create two A records, unproxied:

| Type | Name      | Value         |
|------|-----------|---------------|
| A    | `app`     | `<APP_IP>`     |
| A    | `livekit` | `<MEDIA_IP>`   |

Wait for these to resolve before requesting TLS certificates.

---

## 2. Base hardening (run on BOTH servers)

The single most important section. The most common compromise of a fresh
public server is SSH password brute-force or an unintentionally exposed
service. Do this before installing anything else.

SSH in as root the first time:

```bash
ssh -i ~/.ssh/id_maqraa root@<SERVER_IP>
```

### 2.1 Update, install firewall + fail2ban, create a non-root user

```bash
apt update && apt upgrade -y
apt install -y ufw fail2ban
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
echo "deploy ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/deploy
```

### 2.2 Verify the new user works BEFORE locking SSH

From your **local machine**, in a separate terminal (keep the root session
open as a safety net):

```bash
ssh -i ~/.ssh/id_maqraa deploy@<SERVER_IP> 'whoami && sudo whoami'
```

Expected output:

```
deploy
root
```

Do not proceed until this works.

### 2.3 Disable root login and password authentication

Back in the root session:

```bash
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/; s/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
grep -rl 'PasswordAuthentication\|PermitRootLogin' /etc/ssh/sshd_config.d/ 2>/dev/null \
  | xargs -r sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/; s/^#*PermitRootLogin.*/PermitRootLogin no/'
sshd -t && systemctl restart ssh
```

If `sshd -t` reports an error, **fix it before restarting** — do not lock
yourself out. Then re-verify from your local machine:

```bash
ssh -i ~/.ssh/id_maqraa deploy@<SERVER_IP> 'echo STILL_IN && sudo whoami'
```

Once this confirms, the root session can be closed. All further work is done
as `deploy`.

### 2.4 Firewall

**App server:**

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo systemctl enable --now fail2ban
```

**Media server:**

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 7881/tcp
sudo ufw allow 5349/tcp
sudo ufw allow 50000:60000/udp
sudo ufw allow 3478/udp
sudo ufw --force enable
sudo systemctl enable --now fail2ban
```

Port reference (media server): `443` = LiveKit WSS via Caddy, `7881` = RTC TCP
fallback, `5349` = TURN/TLS, `3478/udp` = TURN, `50000–60000/udp` = RTC media,
`80` = Let's Encrypt / cert renewal. Note that LiveKit's internal port `7880`
is intentionally **not** opened — it is reachable only via Caddy over
localhost.

---

## 3. App server

All steps as the `deploy` user.

### 3.1 Install the stack

```bash
sudo apt install -y build-essential pkg-config libssl-dev curl git nginx postgresql postgresql-contrib
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source $HOME/.cargo/env
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pnpm
```

Verify:

```bash
rustc --version && node --version && psql --version && nginx -v
```

### 3.2 Clone the repository

```bash
cd ~
git clone https://github.com/ghhamza/miqraa.git
cd miqraa
```

### 3.3 PostgreSQL

Create the database and an application user with a strong, randomly generated
password. **Record the password** — you need it for the backend `.env`.

```bash
DBPASS=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9')
sudo -u postgres psql -c "CREATE DATABASE maqraa;"
sudo -u postgres psql -c "CREATE USER maqraa WITH PASSWORD '$DBPASS';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE maqraa TO maqraa;"
sudo -u postgres psql -d maqraa -c "GRANT ALL ON SCHEMA public TO maqraa;"
sudo -u postgres psql -d maqraa -c "ALTER DATABASE maqraa OWNER TO maqraa;"
echo "SAVE THIS: DB_PASSWORD=$DBPASS"
```

PostgreSQL on Ubuntu listens on `localhost` only by default. Leave it that
way — the backend connects locally; the database must never be exposed to the
network.

### 3.4 Backend environment

Generate secrets and write `backend/.env`. Replace `<DB_PASSWORD>` with the
value from the previous step, and fill in your own domain and (optional)
Quran Foundation credentials.

```bash
JWT=$(openssl rand -hex 64)
LKKEY="maqraa_$(openssl rand -hex 6)"
LKSECRET=$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9')

cat > ~/miqraa/backend/.env <<EOF
DATABASE_URL=postgres://maqraa:<DB_PASSWORD>@localhost:5432/maqraa
JWT_SECRET=$JWT
HOST=127.0.0.1
PORT=3000
RECORDINGS_PATH=/home/deploy/miqraa/backend/data/recordings
QF_ENV=prelive
QF_CLIENT_ID=<YOUR_QF_CLIENT_ID>
QF_CLIENT_SECRET=<YOUR_QF_CLIENT_SECRET>
QF_REDIRECT_URI=https://<APP_DOMAIN>/auth/qf/callback
QF_SCOPES=openid offline_access reading_session streak activity_day user
QF_AUDIO_CDN_BASE_URL=https://audio.qurancdn.com
APP_MEDIA_BACKEND=livekit
APP_LIVEKIT_URL=wss://<MEDIA_DOMAIN>
APP_LIVEKIT_HTTP_URL=https://<MEDIA_DOMAIN>
APP_LIVEKIT_API_KEY=$LKKEY
APP_LIVEKIT_API_SECRET=$LKSECRET
RUST_LOG=info
EOF

chmod 600 ~/miqraa/backend/.env
echo "SAVE THESE FOR THE MEDIA SERVER:"
echo "APP_LIVEKIT_API_KEY=$LKKEY"
echo "APP_LIVEKIT_API_SECRET=$LKSECRET"
```

Notes:

- `HOST=127.0.0.1` binds the backend to localhost only. Nginx proxies to it;
  it is never publicly exposed.
- The LiveKit key/secret generated here **must be identical** on the media
  server (Section 4). Save them.
- `QF_*` values are only required for Quran Foundation login / streak sync. The
  app runs without them; QF login simply won't work until they are set and the
  redirect URI is registered with Quran Foundation. The `QF_REDIRECT_URI` must
  exactly match a URI registered on the QF application.
- `.env` is `chmod 600` so only the owner can read the DB password and JWT
  secret.

### 3.5 Build the backend

```bash
cd ~/miqraa/backend
source $HOME/.cargo/env
cargo build --release
```

Sanity-check that it starts and applies migrations (it will be killed after
15s — that is expected):

```bash
timeout 15 ./target/release/miqraa-backend; echo "---EXIT---"
```

You should see the database connect and migrations apply with no errors.

### 3.6 Create an admin user

```bash
./target/release/miqraa-backend create-admin \
  --name "Your Name" \
  --email "you@example.com" \
  --password "<A_STRONG_PASSWORD>"
```

### 3.7 Run the backend as a systemd service

```bash
sudo tee /etc/systemd/system/maqraa-backend.service > /dev/null <<'EOF'
[Unit]
Description=Maqraa Rust backend
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=deploy
WorkingDirectory=/home/deploy/miqraa/backend
EnvironmentFile=/home/deploy/miqraa/backend/.env
ExecStart=/home/deploy/miqraa/backend/target/release/miqraa-backend
Restart=always
RestartSec=5
LimitNOFILE=65536
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=read-only
ReadWritePaths=/home/deploy/miqraa/backend/data
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now maqraa-backend
sudo systemctl status maqraa-backend --no-pager | head -12
```

Confirm it shows `active (running)`.

### 3.8 Build the frontend

In production the frontend is served as static files by Nginx and talks to the
backend same-origin via `/api` (so `VITE_API_BASE_URL` is left unset).

```bash
cd ~/miqraa/frontend
pnpm install --frozen-lockfile
pnpm build
```

This produces `frontend/dist/`.

### 3.9 Nginx

```bash
sudo tee /etc/nginx/sites-available/maqraa > /dev/null <<'EOF'
server {
    listen 80;
    server_name <APP_DOMAIN>;
    root /home/deploy/miqraa/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $http_connection;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
map $http_upgrade $http_connection { default upgrade; '' close; }
EOF

sudo ln -sf /etc/nginx/sites-available/maqraa /etc/nginx/sites-enabled/maqraa
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Replace `<APP_DOMAIN>` with your real domain in the config above.

**Home directory traversal:** Nginx (`www-data`) must be able to traverse into
the home directory to read `frontend/dist`. Grant traverse-only (not read)
permission on the home directory:

```bash
sudo chmod o+x /home/deploy
sudo systemctl reload nginx
```

`o+x` allows directory traversal without granting read access to other files
in the home directory.

### 3.10 TLS certificate

DNS for `<APP_DOMAIN>` must already point at this server.

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d <APP_DOMAIN> --non-interactive --agree-tos -m your@email.com --redirect
```

Certbot installs a renewal timer automatically.

### 3.11 Verify (from your local machine)

```bash
curl -sI https://<APP_DOMAIN> | head -1
curl -s -o /dev/null -w "%{http_code}\n" https://<APP_DOMAIN>/api/auth/me
```

Expected: the first returns `HTTP/1.1 200 OK`; the second returns `401`
(unauthenticated, which proves the API and proxy work).

---

## 4. Media server (LiveKit)

All steps as the `deploy` user, after the Section 2 hardening is done on this
server too.

### 4.1 Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy
sudo systemctl enable --now docker
docker --version && docker compose version
```

(Log out and back in for the docker group to take effect, or prefix the
commands below with `sudo`.)

### 4.2 LiveKit + Caddy configuration

Use the **same** API key and secret you generated on the app server
(Section 3.4). Replace `<MEDIA_DOMAIN>` with your media subdomain.

```bash
mkdir -p ~/livekit

cat > ~/livekit/livekit.yaml <<'EOF'
port: 7880
bind_addresses:
  - "0.0.0.0"
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true
keys:
  <APP_LIVEKIT_API_KEY>: <APP_LIVEKIT_API_SECRET>
turn:
  enabled: true
  domain: <MEDIA_DOMAIN>
  tls_port: 5349
  udp_port: 3478
  external_tls: true
EOF

cat > ~/livekit/caddy.yaml <<'EOF'
logging:
  logs:
    default:
      level: INFO
storage:
  "module": file_system
  "root": "/data"
apps:
  tls:
    certificates:
      automate:
        - <MEDIA_DOMAIN>
  layer4:
    servers:
      main:
        listen:
          - ":443"
        routes:
          - match:
              - tls:
                  sni:
                    - "<MEDIA_DOMAIN>"
            handle:
              - handler: tls
                connection_policies:
                  - alpn:
                      - http/1.1
              - handler: proxy
                upstreams:
                  - dial:
                      - "localhost:7880"
EOF

cat > ~/livekit/docker-compose.yml <<'EOF'
services:
  caddy:
    image: livekit/caddyl4
    command: run --config /etc/caddy.yaml --adapter yaml
    restart: unless-stopped
    network_mode: host
    volumes:
      - ./caddy.yaml:/etc/caddy.yaml
      - caddy_data:/data
  livekit:
    image: livekit/livekit-server:latest
    restart: unless-stopped
    command: --config /etc/livekit.yaml
    network_mode: host
    volumes:
      - ./livekit.yaml:/etc/livekit.yaml
volumes:
  caddy_data:
EOF
```

Edit the three files to substitute `<MEDIA_DOMAIN>`,
`<APP_LIVEKIT_API_KEY>`, and `<APP_LIVEKIT_API_SECRET>` with the real values.

> Caddy manages its own TLS certificate for `<MEDIA_DOMAIN>` via Let's Encrypt
> (HTTP-01), which is why port 80 must be open on the media server. LiveKit's
> raw port `7880` is reachable only via Caddy over localhost and is not exposed
> through the firewall.

### 4.3 Start

```bash
cd ~/livekit
sudo docker compose up -d
sleep 10
sudo docker compose ps
sudo docker compose logs caddy --tail 10
```

Both containers should be `Up`. The Caddy logs should show a certificate being
obtained for `<MEDIA_DOMAIN>`.

### 4.4 Verify (from your local machine)

```bash
curl -sI https://<MEDIA_DOMAIN> | head -1
```

Expected: `HTTP/1.1 200 OK` (LiveKit responding through Caddy TLS).

---

## 5. Post-install security verification

Run these to confirm the install is actually hardened. The two that matter
most are SSH lockdown and that no internal service is publicly exposed — those
are the failure modes that most commonly lead to a compromise.

### 5.1 External port scan (from your local machine)

```bash
nmap -Pn -p 22,80,443,3000,5432,7880,7881 <APP_IP>
nmap -Pn -p 22,80,443,7880,7881,5349 <MEDIA_IP>
```

Expected:

- **App server:** `22, 80, 443` open. `3000` (backend) and `5432` (Postgres)
  **filtered/closed** — they must not be reachable from the internet.
- **Media server:** `22, 80, 443, 7881, 5349` open. `7880` **filtered** — raw
  LiveKit must not be directly reachable; only Caddy on 443 is.

### 5.2 On each server

```bash
# SSH is locked down
sudo sshd -T | grep -Ei 'passwordauthentication|permitrootlogin|pubkeyauthentication'
# Expect: passwordauthentication no, permitrootlogin no, pubkeyauthentication yes

# fail2ban is protecting sshd
sudo fail2ban-client status sshd

# Firewall is active and minimal
sudo ufw status verbose

# Nothing sensitive is listening on a public interface
sudo ss -tlnp | grep -v '127.0.0.1\|::1'
# App server: only sshd:22 and nginx:80/443 should be public.
# Postgres (5432) and backend (3000) must NOT appear here.

# No unexpected SSH keys (detects a backdoor)
cat ~/.ssh/authorized_keys
sudo cat /root/.ssh/authorized_keys 2>/dev/null
# Only your own deploy key should be present.
```

On the app server only:

```bash
# Secrets are not world-readable
stat -c '%a %U' ~/miqraa/backend/.env
# Expect: 600 deploy
```

### 5.3 Database is not remotely reachable (from your local machine)

```bash
nc -vz -w 5 <APP_IP> 5432
```

Expected: connection refused or timeout.

---

## 6. Operations

### Updating the application

App server:

```bash
cd ~/miqraa
git pull
# Backend
cd backend
source $HOME/.cargo/env
cargo build --release
sudo systemctl restart maqraa-backend
# Frontend
cd ../frontend
pnpm install --frozen-lockfile
pnpm build
# (no service restart needed — Nginx serves the new dist/ immediately)
```

Database migrations run automatically at backend startup.

### Logs

```bash
# Backend
sudo journalctl -u maqraa-backend -f
# Nginx
sudo tail -f /var/log/nginx/error.log
# LiveKit (media server)
cd ~/livekit && sudo docker compose logs -f
```

### Service control

```bash
sudo systemctl restart maqraa-backend          # app server
cd ~/livekit && sudo docker compose restart     # media server
```

### TLS renewal

- App server: certbot installs a systemd timer; renewal is automatic. Verify
  with `sudo certbot renew --dry-run`.
- Media server: Caddy renews automatically. Port 80 must remain open for
  HTTP-01 validation.

---

## 7. Notes and caveats

- **Quran Foundation login** requires valid `QF_CLIENT_ID` /
  `QF_CLIENT_SECRET` and the `QF_REDIRECT_URI` to be registered, exactly, on
  the QF application side. Until then, QF login and streak sync will not work;
  the rest of the platform functions normally.
- **Secret rotation:** if any secret (DB password, `JWT_SECRET`, LiveKit
  key/secret, QF secret) is ever exposed, rotate it. Rotating `JWT_SECRET`
  invalidates all existing sessions and forces re-login.
- **Sizing:** the app server must have enough RAM for a Rust release build
  (8 GB recommended). Building on an undersized box can fail with an
  out-of-memory linker error.
- **Reverse proxy / CDN:** keep DNS unproxied. A proxy in front of the servers
  interferes with WebRTC media and Let's Encrypt validation.
- **License:** Maqraa is AGPL-3.0. If you self-host a modified version and make
  it available over a network, the AGPL's network-use provision applies.
