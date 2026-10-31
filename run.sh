#!/usr/bin/env bash
# One command: build the web app, then start API + app on one port (default 8000).
#   ./run.sh            run locally (http://localhost:8000)
#   ./run.sh tunnel     also open a free HTTPS tunnel (cloudflared) so real phones can use camera + offline mode
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env ] && { set -a; . ./.env; set +a; }
command -v uv >/dev/null || { echo "Install uv first: https://docs.astral.sh/uv/"; exit 1; }
[ -d node_modules ] || npm install --no-audit --no-fund
npm run build --silent
PORT="${PORT:-8000}"
if [ "${1:-}" = "tunnel" ]; then
  command -v cloudflared >/dev/null || { echo "Install cloudflared (free, no account needed for quick tunnels), or use: ssh -R 80:localhost:$PORT nokey@localhost.run"; exit 1; }
  cloudflared tunnel --url "http://localhost:$PORT" &
  trap 'kill %1 2>/dev/null || true' EXIT
fi
cd backend
exec uv run --with-requirements requirements.txt python -m nipay
