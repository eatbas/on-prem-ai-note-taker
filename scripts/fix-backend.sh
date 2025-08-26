#!/usr/bin/env bash

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

MODEL="${1:-}"

echo -e "${BLUE}🔧 Fixing backend stack (Redis URL, model availability)${NC}"
echo "=================================================="

cd /myca/on-prem-ai-note-taker

echo -e "${BLUE}🐳 Rebuilding and restarting services...${NC}"
docker compose up -d --build redis ollama backend

echo -e "${BLUE}⏳ Waiting for services...${NC}"
sleep 5

echo -e "${BLUE}📋 Backend env OLLAMA_MODEL...${NC}"
BACKEND_MODEL=$(docker compose exec -T backend printenv OLLAMA_MODEL 2>/dev/null || true)
echo "backend OLLAMA_MODEL='${BACKEND_MODEL}'"

if [[ -z "${MODEL}" ]]; then
  MODEL="${BACKEND_MODEL}"
fi

if [[ -n "${MODEL}" ]]; then
  echo -e "${BLUE}🤖 Ensuring model present in ollama: ${MODEL}${NC}"
  docker compose exec -T ollama ollama pull "${MODEL}" || true
else
  echo -e "${YELLOW}⚠️  No model specified and backend did not expose OLLAMA_MODEL.${NC}"
fi

echo -e "${BLUE}🧪 Testing generate endpoint through backend container...${NC}"
BASE_URL=$(docker compose exec -T backend printenv OLLAMA_BASE_URL 2>/dev/null || echo 'http://ollama:11434')
GEN_STATUS=$(docker compose exec -T backend bash -lc "curl -s -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' -d '{\"model\":\"'\"${MODEL}\"'\",\"prompt\":\"hi\",\"stream\":false}' '${BASE_URL}/api/generate'" || echo 'ERR')
echo "Generate HTTP status: ${GEN_STATUS}"

echo -e "${BLUE}🧪 Health check: backend and ollama...${NC}"
echo -n "Backend /api/health: "; curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8000/api/health || echo 'ERR'
echo -n "Ollama /api/version: "; curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:11434/api/version || echo 'ERR'

echo -e "${GREEN}✅ Backend fix script completed${NC}"


