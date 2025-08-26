#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/myca/on-prem-ai-note-taker"
cd "$APP_DIR"

PUB_IP="${1:-$(curl -fsS https://api.ipify.org || hostname -I | awk '{print $1}')}"

OVERRIDE_FILE="$APP_DIR/docker-compose.override.yml"
echo "Creating compose override with explicit ALLOWED_ORIGINS for ${PUB_IP} ..."
cat > "$OVERRIDE_FILE" <<YAML
services:
  backend:
    environment:
      ALLOWED_ORIGINS: "http://localhost:5173,http://${PUB_IP},null"
YAML

echo "Rebuilding and restarting backend..."
docker compose up -d --build backend

sleep 2

echo
echo "=== GET /api/health (Origin: http://localhost:5173) ==="
curl -s -D - -o /dev/null -H "Origin: http://localhost:5173" "http://${PUB_IP}:8000/api/health" | \
  awk 'BEGIN{IGNORECASE=1} /HTTP\/|access-control-allow-origin|access-control-allow-credentials|content-type|vary/'

echo
echo "=== GET /api/health (Origin: null) ==="
curl -s -D - -o /dev/null -H "Origin: null" "http://${PUB_IP}:8000/api/health" | \
  awk 'BEGIN{IGNORECASE=1} /HTTP\/|access-control-allow-origin|access-control-allow-credentials|content-type|vary/'

echo
echo "=== OPTIONS /api/transcribe (preflight) ==="
curl -s -D - -o /dev/null -X OPTIONS \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Authorization,Content-Type" \
  "http://${PUB_IP}:8000/api/transcribe" | \
  awk 'BEGIN{IGNORECASE=1} /HTTP\/|access-control-allow-origin|access-control-allow-headers|access-control-allow-methods|access-control-allow-credentials|access-control-max-age|vary/'

echo
echo "Done. For a different IP/origin list, run:"
echo "  $0 95.111.244.159"
