#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${YELLOW}=== Neo Docker Startup Script ===${NC}\n"

# Create network if it doesn't exist
echo -e "${YELLOW}[1] Creating network...${NC}"
docker network create neo-network 2>/dev/null || echo "Network already exists"
echo -e "${GREEN}✓ Network ready${NC}\n"

# Start all services with all compose files together
echo -e "${YELLOW}[2] Starting all services...${NC}"

docker compose \
    -f 01-milvus.yml \
    -f 02-ollama.yml \
    -f 03-postgres.yml \
    -f 04-open-webui.yml \
    -f 05-pgadmin.yml \
    -f 06-nginx.yml \
    -f 07-redis.yml \
    up -d --remove-orphans --build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ All services started${NC}"
else
    echo -e "${RED}✗ Failed to start services${NC}"
fi

echo ""
echo -e "${GREEN}=== All services started! ===${NC}\n"
echo "Access points:"
echo "  - Frontend: http://localhost:5173"
echo "  - Backend:  http://localhost:8000"
echo "  - Milvus:   http://localhost:19530"
echo "  - pgAdmin:  http://localhost:5050"
echo "  - OpenWebUI: http://localhost:3000"
echo "  - Nginx:   http://localhost:80"
