#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/myca/on-prem-ai-note-taker"
BACKEND_ENV="$APP_DIR/backend/.env"

# Detect public IP (fallback to first local IP if api.ipify fails)
PUB_IP="$(curl -fsS https://api.ipify.org || hostname -I | awk '{print $1}')"
DEFAULT_ORIGINS="http://localhost:5173,http://${PUB_IP},null"

# Allow override via first arg: comma-separated, no brackets/quotes
ORIGINS="${1:-$DEFAULT_ORIGINS}"

echo "Using ALLOWED_ORIGINS: ${ORIGINS}"

cd "$APP_DIR"

# Ensure .env exists
if [ ! -f "$BACKEND_ENV" ]; then
  echo "Creating backend/.env from example..."
  cp "$APP_DIR/backend/env.example" "$BACKEND_ENV"
fi

cp "$BACKEND_ENV" "${BACKEND_ENV}.bak.$(date +%s)"

# Write ALLOWED_ORIGINS (comma-separated, no brackets/quotes)
if grep -q '^ALLOWED_ORIGINS=' "$BACKEND_ENV"; then
  sed -i -E "s|^ALLOWED_ORIGINS=.*$|ALLOWED_ORIGINS=${ORIGINS}|g" "$BACKEND_ENV"
else
  echo "ALLOWED_ORIGINS=${ORIGINS}" >> "$BACKEND_ENV"
fi

echo "Updated line:"
grep '^ALLOWED_ORIGINS=' "$BACKEND_ENV" || true

echo "Rebuilding and restarting backend..."
docker compose up -d --build backend

# Simple wait for container to be ready
sleep 2

# Verify CORS headers for browser (http://localhost:5173), electron (null), and IP origin
echo
echo "=== Verifying CORS (GET /api/health) ==="
for ORIGIN in "http://localhost:5173" "null" "http://${PUB_IP}"; do
  echo "-- Origin: ${ORIGIN}"
  curl -s -D - -o /dev/null -H "Origin: ${ORIGIN}" "http://${PUB_IP}:8000/api/health" | \
    awk 'BEGIN{IGNORECASE=1} /HTTP\/|access-control-allow-origin|access-control-allow-credentials|content-type|vary/'
  echo
done

echo "=== Verifying preflight (OPTIONS /api/transcribe) ==="
curl -s -D - -o /dev/null -X OPTIONS \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Authorization,Content-Type" \
  "http://${PUB_IP}:8000/api/transcribe" | \
  awk 'BEGIN{IGNORECASE=1} /HTTP\/|access-control-allow-origin|access-control-allow-headers|access-control-allow-methods|access-control-allow-credentials|access-control-max-age|vary/'

echo
echo "Done. If any GET still shows Access-Control-Allow-Origin: *, re-run with explicit origins:"
echo "  $0 \"http://localhost:5173,http://${PUB_IP},null\""
