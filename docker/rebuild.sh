#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${YELLOW}=== Stopping Rage Services ===${NC}\n"

# Keep volumes - do NOT use --volumes flag
docker compose \
    -f 01-milvus.yml \
    -f 02-ollama.yml \
    -f 03-postgres.yml \
    -f 04-open-webui.yml \
    -f 05-pgadmin.yml \
    -f 06-nginx.yml \
    -f 07-redis.yml \
    down --remove-orphans

# Start fresh
echo "Starting containers ..."
./start.sh

echo "=== Done ==="