#!/usr/bin/env bash
# ==============================================================================
# Marmalade / Poetree — SQLite Backup Script
# Delegates to Node.js native online backup (no external sqlite3 CLI required)
# ==============================================================================

set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "${DIR}/backup.js" "$@"
