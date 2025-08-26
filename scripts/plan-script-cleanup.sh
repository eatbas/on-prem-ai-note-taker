#!/usr/bin/env bash

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

APPLY=false
if [[ "${1:-}" == "--apply" ]]; then
  APPLY=true
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

echo -e "${BLUE}🧹 Script Cleanup Planner${NC}"
echo "=================================================="
echo "Mode: ${APPLY:+APPLY}${APPLY:-DRY-RUN}"
echo "Root: ${REPO_ROOT}"
echo ""

# Inventory
echo -e "${BLUE}📦 Inventory of scripts:${NC}"
ls -1 scripts | sed 's/^/  - /'
echo ""

# Candidates for deprecation (overlaps or dev-only)
declare -a REMOVE
declare -a KEEP

# Keep core useful scripts
KEEP+=(
  "check-ollama-setup.sh"
  "check-vps-status.sh"
  "vps-diagnostics.sh"
  "fix-external-access.sh"
  "plan-script-cleanup.sh"
  "setup-local-backend.sh"
  "llama-performance-test.sh"
)

# Remove legacy or redundant ones (subject to review)
REMOVE+=(
  "extract-vps-ip.sh"             # superseded by get-vps-ip-only.sh
  "get-vps-ip.sh"                 # interactive/overlap with start-electron-dev.sh
  "get-vps-ip-only.sh"            # trivial helper, replace with grep or env loader
  "quick-start.sh"                # wraps other scripts; confusing
  "install-mac-app.sh"            # platform-specific, likely obsolete here
  "start-electron-dev.sh"         # frontend/electron flow may be elsewhere
  "test-connection.sh"            # overlapped by check-vps-status.sh
  "test-dev-server.sh"            # frontend-only helper
  "build-desktop-app.sh"          # build pipeline likely elsewhere
  "build-desktop-app.bat"         # Windows batch
  "dev-quick-start.bat"           # Windows batch
  "llama-performance-test.bat"    # Windows batch
  "start-electron-dev.bat"        # Windows batch
  "test-dev-server.bat"           # Windows batch
  "test-vps.ps1"                  # PowerShell
  "secure_server.py"              # not a shell script, likely stray
)

echo -e "${BLUE}✅ Keep list:${NC}"
printf '  - %s\n' "${KEEP[@]}"
echo ""

echo -e "${BLUE}🗑️  Remove candidates:${NC}"
printf '  - %s\n' "${REMOVE[@]}"
echo ""

if ${APPLY}; then
  echo -e "${YELLOW}Applying removals...${NC}"
  for f in "${REMOVE[@]}"; do
    if [[ -e "scripts/$f" ]]; then
      git rm -f "scripts/$f" 2>/dev/null || rm -f "scripts/$f"
      echo "Removed scripts/$f"
    else
      echo "Skip (not found): scripts/$f"
    fi
  done
  echo -e "${GREEN}Cleanup applied.${NC}"
else
  echo -e "${YELLOW}Dry run only. To apply: scripts/plan-script-cleanup.sh --apply${NC}"
fi


