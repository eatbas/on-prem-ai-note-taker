#!/usr/bin/env bash
set -euo pipefail

# Usage on VPS (Ubuntu 22.04/24.04):
#   curl -fsSL https://get.docker.com | sh
#   sudo usermod -aG docker $USER && newgrp docker
#   bash provision-vps.sh <REPO_URL>

REPO_URL=${1:-}
if [ -z "$REPO_URL" ]; then
  echo "Usage: $0 <REPO_URL>" >&2
  exit 1
fi

# Install prerequisites
if ! command -v git >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo apt-get install -y git
fi

# Clone or update repo
if [ ! -d on-prem-ai-note-taker ]; then
  git clone "$REPO_URL" on-prem-ai-note-taker
else
  cd on-prem-ai-note-taker
  git pull --rebase
  cd -
fi

cd on-prem-ai-note-taker

# Start stack
docker compose up -d --build

# Pull default model
if docker compose ps ollama >/dev/null 2>&1; then
  docker compose exec -T ollama ollama pull qwen2.5:3b-instruct || true
fi

echo "Stack is up. Frontend: port 8080, Backend: port 8000"
