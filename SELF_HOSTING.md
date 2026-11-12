# Self-Hosting Marmalade

Marmalade is designed from the ground up for single-family self-hosting. There are no central servers, no telemetry, and no mandatory subscriptions. Your family's accounts, boundaries, and saved creations remain strictly on your own hardware or private cloud instance.

---

## Deployment Options

Choose the deployment method that fits your setup:

1. [Docker Compose (Local Mac/PC, Home Server, or Raspberry Pi)](#1-docker-compose-recommended-for-home-servers)
2. [Turnkey Cloud: Fly.io](#2-flyio-deployment)
3. [Turnkey Cloud: Railway or Render](#3-railway--render-deployment)
4. [Direct Node.js (macOS or Linux)](#4-direct-nodejs-on-macos-or-linux)

---

## 1. Docker Compose (Recommended for Home Servers)

If you have Docker installed on a Mac, PC, Linux machine, or Raspberry Pi:

```bash
git clone https://github.com/j-nilesh/marmalade.git
cd marmalade

# Start Marmalade
docker compose up -d
```

### Initial First-Run Experience

1. Open **`http://localhost:4120`** in your browser.
2. Complete the **60-second household setup**: choose your parent password, your child's username, and time zone. (If `SETUP_TOKEN` is configured, enter the token to initialize).
3. Once initialized, Marmalade opens in **Demo Mode** using the built-in deterministic mock provider—allowing you and your child to explore Ask, Research, Schoolwork, and Play with full sample responses and zero setup or API costs.
4. When you're ready, visit **Parent Settings** (`/parent`) to connect free offline Ollama or a commercial provider.

### Running with 100% Free, Offline AI (Ollama)
To run Marmalade completely offline with zero API keys or cloud bills:

1. Install [Ollama](https://ollama.ai) on the host machine.
2. Pull an efficient, kid-friendly model:
   ```bash
   ollama pull llama3.2
   ```
3. In Marmalade's **Parent Settings → AI Connection**:
   - Choose **Ollama**.
   - Model name: `llama3.2`
   - Test and save the connection!

### Optional: Private Search (SearXNG)
To enable private web search without any external API:
```bash
docker compose --profile research up -d
```
Then in **Parent Settings → Web Research**, configure the SearXNG endpoint at `http://searxng:8080/search`.

---

## Network Security & Access Control

Marmalade is designed for single-family private hosting. Choose the network binding appropriate for your environment:

### A. Localhost Only (Safest Default for a Single Computer)
By default, `docker-compose.yml` binds to `127.0.0.1:4120`. Marmalade is accessible exclusively from the computer running Docker. No devices on your local Wi-Fi or the internet can reach the application.

### B. Home Wi-Fi / LAN Access (For Family Tablets and Laptops)
To allow children to access Marmalade from iPads, laptops, or other devices on your home Wi-Fi:
1. In your `.env` file, set:
   ```env
   MARMALADE_BIND_IP=0.0.0.0
   ```
2. Restart the container:
   ```bash
   docker compose up -d
   ```
3. Family devices on your home network can then navigate to `http://<server-ip>:4120` (e.g. `http://192.168.1.150:4120`).
4. **Important Security Precautions:**
   - Only bind to `0.0.0.0` on a private, password-protected home network behind your router's NAT firewall.
   - **Never forward port 4120** on your router directly to the public internet without HTTPS and authentication.

### C. Public Cloud, VPS, or Remote Internet Exposure
If hosting Marmalade on a remote VPS (Hetzner, DigitalOcean, Linode, AWS) or accessing your instance from outside your home:
1. **Never expose raw HTTP port 4120 directly to the internet.**
2. Place Marmalade behind a reverse proxy terminating TLS/HTTPS, such as **Caddy**, **Nginx**, **Cloudflare Tunnel**, or a private mesh VPN like **Tailscale**.
3. **Always configure `SETUP_TOKEN`** in `.env` before starting the server. This prevents internet scanners or strangers from claiming first-run household setup.
4. Set `TRUST_PROXY=true` in `.env` so rate limiting properly identifies client IPs behind your reverse proxy.

#### Example Caddy Configuration
```caddyfile
marmalade.yourfamily.com {
    reverse_proxy 127.0.0.1:4120
}
```

#### Example Nginx Configuration
```nginx
server {
    listen 443 ssl http2;
    server_name marmalade.yourfamily.com;

    ssl_certificate /etc/letsencrypt/live/marmalade.yourfamily.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/marmalade.yourfamily.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:4120;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 2. Fly.io Deployment

Fly.io offers global hosting with persistent storage volumes:

1. Install the [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/).
2. Authenticate:
   ```bash
   fly auth login
   ```
3. Copy the example configuration:
   ```bash
   cp fly.example.toml fly.toml
   ```
4. Edit `fly.toml` and pick a unique app name (e.g., `app = "my-family-marmalade"`).
5. Create your persistent SQLite volume (in your preferred region, e.g., `iad` or `sin`):
   ```bash
   fly volumes create marmalade_data --size 1 --region iad
   ```
6. (Recommended for public cloud URLs) Set `SETUP_TOKEN` secret to prevent unauthorized first-run setup:
   ```bash
   fly secrets set SETUP_TOKEN="your-secret-passphrase"
   ```
7. Deploy:
   ```bash
   fly deploy
   ```

> **Tip**: Marmalade automatically detects Fly.io edge proxies (`FLY_APP_NAME`) to prevent IP spoofing in login rate limiting, and includes `min_machines_running = 1` in `fly.toml` so your instance stays warm and never drops the connection when your child asks a question.

---

## 3. Railway & Render Deployment

### Railway
1. Fork or push the Marmalade repository to your GitHub account.
2. In Railway, click **New Project → Deploy from GitHub repo**.
3. Add a **Persistent Volume** mounted at `/app/data`.
4. Add environment variables:
   - `MARMALADE_PORT=4120`
   - `MARMALADE_HOST=0.0.0.0`
   - `MARMALADE_DB_PATH=/app/data/marmalade.db`
   - `SETUP_TOKEN=your-secret-passphrase` *(recommended for public instances)*
   - `TRUST_PROXY=true`
   *(Note: Existing `SPROUT_*` environment variables continue to be supported as silent fallback).*
5. Generate a public domain and visit your app!

### Render
1. Create a new **Web Service** pointing to your repository.
2. Select **Docker** environment.
3. Attach a **Disk** mounted at `/app/data` (size: 1 GB).
4. Set environment variables:
   - `MARMALADE_PORT=4120`
   - `MARMALADE_HOST=0.0.0.0`
   - `MARMALADE_DB_PATH=/app/data/marmalade.db`
   - `SETUP_TOKEN=your-secret-passphrase` *(recommended for public instances)*
   - `TRUST_PROXY=true`

---

## 4. Direct Node.js (macOS or Linux)

Prerequisites: **Node.js 20+** and **npm**.

```bash
# Clone the repository
git clone https://github.com/j-nilesh/marmalade.git
cd marmalade

# Install dependencies and build
npm install
npm run build

# Start the server
npm start
```

For Mac users who want to run Marmalade over the local Wi-Fi network:
```bash
MARMALADE_HOST=0.0.0.0 ./scripts/start-family-mac.sh
```

---

## Configuring AI Providers

Marmalade connects directly to the providers of your choice. Keys are stored encrypted server-side in SQLite and are never exposed to the child's browser:

| Provider | Best For | Recommended Models |
| :--- | :--- | :--- |
| **Ollama** | 100% offline, zero-cost, total privacy | `llama3.2`, `gemma2:9b`, `qwen2.5:7b` |
| **Anthropic Claude** | Warmest conversational tone, best Socratic coaching | `claude-haiku-5-5`, `claude-sonnet-5-5` |
| **OpenAI** | Solid general reasoning | `gpt-4o-mini`, `gpt-4o` |

> **OpenAI Under-18 API Guidance**: OpenAI permits under-18 use with age-appropriate guardrails, AI disclosure, and safety-aligned models (such as `gpt-4o-mini` or `gpt-4o`). For children under 13, you act as the parent operator under COPPA, and Zero Data Retention (ZDR) must be active on your OpenAI organization account. Confirm ZDR directly with OpenAI; Marmalade records parent self-acknowledgment and tests connectivity.

> **Note on Google Gemini**: Google's API Terms of Service require developers and end users to be at least 18 years of age. In strict compliance with child protection guidelines and provider policies, Marmalade restricts Google Gemini for minor/child workspaces.

---

## Enabling Safe Web Research

Children can safely research school topics using independent web search:

1. **Brave Search API (Recommended)**:
   - Sign up for a developer account at [brave.com/search/api](https://brave.com/search/api/).
   - Developer accounts include free monthly credits and tiered usage (check official pricing and allowances at brave.com/search/api).
   - Enter your subscription token in **Parent Settings → Web Research**.
2. **Private SearXNG**:
   - Host your own SearXNG container (included in `docker-compose.yml`).
   - Completely private; no logs, no external query profiles.

---

## Backups & Maintenance

Your entire family instance (accounts, limits, and saved creations) lives in a single SQLite database file (`/app/data/marmalade.db` or `./data/sprout.db`) alongside its per-instance key file (`data/.encryption_secret`).

### Creating a Hot Backup
Perform a safe online backup using SQLite's native C++ backup API without taking the server offline:
```bash
# Direct or inside container
npm run backup
```
Backups are timestamped and saved into `./backups/` with automated rotation (retaining the last 7 backups by default).

### Restoring from Backup
To restore a backup safely, use the built-in restore command. It validates database integrity and cleans up stale `-wal` and `-shm` write-ahead log files to prevent corruption:
```bash
npm run restore -- --backup backups/marmalade_backup_YYYYMMDD_HHMMSS.db
```

> **Important**: Stored API keys are encrypted at rest using AES-256-GCM keyed by `data/.encryption_secret` (generated on first boot with `0600` file permissions). When migrating to a new machine or restoring backups, always copy `data/.encryption_secret` alongside the database, otherwise stored API keys will need to be re-entered in Parent Settings.

### Resetting Parent Password
If you ever lose access to the parent account, reset the password directly via CLI:
```bash
# Local installation:
npm run reset-password

# Docker installation:
docker compose exec marmalade npm run reset-password

# Fly.io installation:
fly ssh console -C "npm run reset-password"
```
