#!/usr/bin/env bash
# One command: build both websites, then start both servers.
#   ./run.sh            user site  http://localhost:8000   admin site  http://localhost:8001
#   ./run.sh tunnel     also open one free HTTPS tunnel (cloudflared) per site, and print both public URLs
# The two sites are separate: own build, own port and origin, own CORS list, own auth. Ctrl-C stops everything.
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env ] && { set -a; . ./.env; set +a; }
command -v uv >/dev/null || { echo "Install uv first: https://docs.astral.sh/uv/"; exit 1; }
[ -d node_modules ] || npm install --no-audit --no-fund
npm run build --silent
USER_PORT="${USER_PORT:-8000}"; ADMIN_PORT="${ADMIN_PORT:-8001}"
PIDS=()
cleanup() { for p in "${PIDS[@]:-}"; do [ -n "$p" ] && { pkill -P "$p" 2>/dev/null; kill "$p" 2>/dev/null; } || true; done; wait 2>/dev/null || true; }
trap cleanup EXIT INT TERM
if [ "${1:-}" = "tunnel" ]; then
  command -v cloudflared >/dev/null || { echo "Install cloudflared (free, no account needed for quick tunnels)"; exit 1; }
  for pair in "user:$USER_PORT" "admin:$ADMIN_PORT"; do
    name="${pair%%:*}"; port="${pair##*:}"; log="$(mktemp)"
    cloudflared tunnel --url "http://localhost:$port" >"$log" 2>&1 & PIDS+=($!)
    for _ in $(seq 1 40); do url="$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$log" | head -1 || true)"; [ -n "$url" ] && break; sleep 0.5; done
    echo "TUNNEL $name site: ${url:-<not ready, see $log>}"
  done
fi
cd backend
PORT="$USER_PORT" uv run --with-requirements requirements.txt python -m nipay user & PIDS+=($!)
PORT="$ADMIN_PORT" uv run --with-requirements requirements.txt python -m nipay admin & PIDS+=($!)
sleep 2
echo
echo "  USER  site (phones):    http://localhost:$USER_PORT"
echo "  ADMIN site (dashboard): http://localhost:$ADMIN_PORT   (projector ledger: http://localhost:$ADMIN_PORT/#/live-ledger)"
wait
