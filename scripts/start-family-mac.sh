#!/usr/bin/env bash
# =============================================================================
# Sprout Core — Friendly 1-Command Launcher for a Family Mac
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

echo "🌱 Starting Sprout Core Family Instance..."

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js is not installed. Install it from https://nodejs.org (v20+) or via 'brew install node'."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies (first run only)..."
  npm install
fi

if [ ! -f "dist/server/server/index.js" ] || [ ! -f "dist/client/index.html" ]; then
  echo "🔨 Building Sprout Core..."
  npm run build
fi

if [ -f "data/sprout.db" ]; then
  ./scripts/backup.sh ./data/sprout.db ./backups >/dev/null 2>&1 || true
fi

PORT="${SPROUT_PORT:-4120}"
HOST="${SPROUT_HOST:-127.0.0.1}"

echo "✅ Sprout Core is running at: http://${HOST}:${PORT}"
echo "💡 Tip: Sign in as Parent to configure API keys, Ollama, and daily allowances in the browser."
exec node dist/server/server/index.js
