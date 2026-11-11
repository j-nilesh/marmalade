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

Open `http://localhost:4120` in your browser to complete the initial family setup.

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
   - `SPROUT_PORT=4120`
   - `SPROUT_HOST=0.0.0.0`
   - `SPROUT_DB_PATH=/app/data/marmalade.db`
   - `SETUP_TOKEN=your-secret-passphrase` *(recommended for public instances)*
   - `TRUST_PROXY=true`
5. Generate a public domain and visit your app!

### Render
1. Create a new **Web Service** pointing to your repository.
2. Select **Docker** environment.
3. Attach a **Disk** mounted at `/app/data` (size: 1 GB).
4. Set environment variables:
   - `SPROUT_DB_PATH=/app/data/marmalade.db`
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
SPROUT_HOST=0.0.0.0 ./scripts/start-family-mac.sh
```

---

## Configuring AI Providers

Marmalade connects directly to the providers of your choice. Keys are stored encrypted server-side in SQLite and are never exposed to the child's browser:

| Provider | Best For | Recommended Models |
| :--- | :--- | :--- |
| **Ollama** | 100% offline, zero-cost, total privacy | `llama3.2`, `gemma2:9b`, `qwen2.5:7b` |
| **Anthropic Claude** | Warmest conversational tone, best Socratic coaching | `claude-haiku-5-5`, `claude-sonnet-5-5` |
| **OpenAI** | Solid general reasoning | `gpt-4o-mini`, `gpt-4o` |

> **Note on Google Gemini**: Google's API Terms of Service require developers and end users to be at least 18 years of age. In strict compliance with child protection guidelines and provider policies, Marmalade restricts Google Gemini for minor/child workspaces.

---

## Enabling Safe Web Research

Children can safely research school topics using independent web search:

1. **Brave Search API (Recommended)**:
   - Sign up for a free developer account at [brave.com/search/api](https://api.search.brave.com/).
   - Generous free tier: **2,000 queries per month** at zero cost.
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
npm run restore -- --backup backups/sprout_backup_YYYYMMDD_HHMMSS.db
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
