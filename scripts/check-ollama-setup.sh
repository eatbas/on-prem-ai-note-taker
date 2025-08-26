#!/usr/bin/env bash

set -euo pipefail

RED="\033[0;31m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
NC="\033[0m"

failures=0

info() { echo -e "${YELLOW}[INFO]${NC} $*"; }
ok() { echo -e "${GREEN}[OK]${NC} $*"; }
err() { echo -e "${RED}[FAIL]${NC} $*"; failures=$((failures+1)); }

# Move to repo root (script directory is repo/scripts)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

info "Using repo root: ${REPO_ROOT}"

# Check docker and compose
if ! command -v docker >/dev/null 2>&1; then
  err "docker not found in PATH"
  echo; exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  err "docker compose (v2) not available. Please install Docker Compose v2."
  echo; exit 1
fi

info "Checking compose services..."
docker compose ps | cat

BACKEND_CID="$(docker compose ps -q backend || true)"
OLLAMA_CID="$(docker compose ps -q ollama || true)"

if [[ -z "${BACKEND_CID}" ]]; then
  err "backend service container is not running (docker compose ps -q backend returned empty)"
else
  ok "backend container: ${BACKEND_CID}"
fi

if [[ -z "${OLLAMA_CID}" ]]; then
  err "ollama service container is not running (docker compose ps -q ollama returned empty)"
else
  ok "ollama container: ${OLLAMA_CID}"
fi

echo
info "Reading backend environment for OLLAMA settings..."
OLLAMA_BASE_URL="$(docker compose exec -T backend printenv OLLAMA_BASE_URL || true)"
OLLAMA_MODEL="$(docker compose exec -T backend printenv OLLAMA_MODEL || true)"

if [[ -z "${OLLAMA_BASE_URL}" ]]; then
  err "OLLAMA_BASE_URL is not set inside backend container"
else
  ok "OLLAMA_BASE_URL=${OLLAMA_BASE_URL}"
fi

if [[ -z "${OLLAMA_MODEL}" ]]; then
  err "OLLAMA_MODEL is not set inside backend container"
else
  ok "OLLAMA_MODEL=${OLLAMA_MODEL}"
fi

echo
info "Checking Ollama reachability from backend container (${OLLAMA_BASE_URL})..."
if docker compose exec -T backend bash -lc "curl -sS -m 5 '${OLLAMA_BASE_URL}/api/version' | grep -q 'version'"; then
  ok "Ollama is reachable from backend"
else
  err "Cannot reach ${OLLAMA_BASE_URL}/api/version from backend container"
fi

echo
info "Checking if model exists in ollama container: ${OLLAMA_MODEL}..."
if docker compose exec -T ollama bash -lc "ollama list | awk '{print \$1}' | grep -Fx '${OLLAMA_MODEL}' >/dev/null 2>&1"; then
  ok "Model present: ${OLLAMA_MODEL}"
else
  err "Model NOT found: ${OLLAMA_MODEL} (run: docker compose exec ollama ollama pull '${OLLAMA_MODEL}')"
fi

echo
info "Performing a minimal generate test from backend (model=${OLLAMA_MODEL})..."
HTTP_CODE=$(docker compose exec -T backend bash -lc \
  "curl -sS -o /dev/null -w '%{http_code}' -m 20 -H 'Content-Type: application/json' \
   -d '{\"model\":\"'\"${OLLAMA_MODEL}\"'\",\"prompt\":\"hi\",\"stream\":false}' \
   '${OLLAMA_BASE_URL}/api/generate'" || true)

if [[ "${HTTP_CODE}" == "200" ]]; then
  ok "Generate endpoint returned 200"
else
  err "Generate endpoint returned HTTP ${HTTP_CODE} (expected 200). Likely model missing or base URL mismatch."
fi

echo
if [[ ${failures} -eq 0 ]]; then
  ok "All checks passed."
  exit 0
else
  err "${failures} check(s) failed. See messages above."
  exit 1
fi


