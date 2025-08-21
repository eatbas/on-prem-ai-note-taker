#!/usr/bin/env bash

# Simple script to extract VPS IP from .env file
# Usage: ./scripts/get-vps-ip-only.sh

if [ -f ".env" ]; then
    VPS_HOST=$(grep "^VPS_HOST=" .env 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'")
    if [ -n "$VPS_HOST" ]; then
        echo "$VPS_HOST"
    else
        echo "VPS_HOST not found in .env file" >&2
        exit 1
    fi
else
    echo ".env file not found" >&2
    exit 1
fi
