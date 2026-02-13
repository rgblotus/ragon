# Rage Docker Services

Directory Structure:
docker/
├── 01-etcd.yml # etcd (Milvus dependency)
├── 02-minio.yml # MinIO (Milvus dependency)
├── 03-milvus.yml # Milvus vector database
├── 04-postgres.yml # PostgreSQL database
├── 05-redis.yml # Redis cache
├── 06-ollama.yml # Ollama LLM
├── 07-open-webui.yml # Open WebUI
├── 08-backend.yml # Backend API
├── 09-frontend.yml # Frontend UI
├── 10-nginx.yml # Nginx proxy
├── 11-pgadmin.yml # pgAdmin
├── start.sh # Start all services
├── stop.sh # Stop all services
└── add-user-to-docker.sh # Add user to docker group

## Usage:

1. Add user to docker group:
   ./add-user-to-docker.sh

    # Log out and back in

2. Start all services:
   ./start.sh

3. Stop all services:
   ./stop.sh

4. Start individual service:
   docker compose -f 08-backend.yml up -d

5. View logs:
   docker logs rage-backend
   docker logs -f rage-backend

## Ports:

- Frontend: 5173
- Backend: 8000
- Milvus: 19530
- pgAdmin: 5050
- OpenWebUI: 3000
- Nginx: 80

## Notes:

- All services connect via 'rage-network' bridge network
- GPU services (milvus, ollama) require NVIDIA drivers
- Services start in order with health checks

sudo docker start rage-milvus-etcd rage-milvus-minio rage-standalone rage-postgres rage-pgadmin rage-redis rage-ollama rage-open-webui rage-backend rage-frontend rage-nginx

Your services are accessible at:

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- Milvus: http://localhost:19530
- pgAdmin: http://localhost:5050 (admin@admin.com / admin123)
- Open WebUI: http://localhost:3000

The complete cleanup of all Docker containers, volumes, networks, and other resources.

# 1. Stop and delete all containers

sudo docker rm -f $(sudo docker ps -aq)

# 2. Delete all volumes

sudo docker volume rm $(sudo docker volume ls -q)

# 3. Delete the network

sudo docker network rm neo-network 2>/dev/null

# 4. Prune everything (images, build cache, networks)

sudo docker system prune -af

# 5. Prune any remaining volumes

sudo docker volume prune -f
