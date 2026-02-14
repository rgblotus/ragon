# Docker Services

Docker configuration for all infrastructure services.

## Directory Structure

```
docker/
├── 01-milvus.yml          # Milvus vector database
├── 02-ollama.yml          # Ollama LLM service
├── 03-postgres.yml        # PostgreSQL database
├── 04-open-webui.yml      # Open WebUI interface
├── 05-pgadmin.yml         # pgAdmin database UI
├── 06-nginx.yml           # Nginx reverse proxy
├── 07-redis.yml           # Redis cache
├── nginx.conf             # Nginx configuration
├── redis.conf             # Redis configuration
├── ollama/
│   └── entrypoint.sh      # Ollama entrypoint script
├── start.sh               # Start all services
├── stop.sh                # Stop all services
├── restart.sh             # Restart all services
├── rebuild.sh             # Rebuild and restart services
└── add-user-to-docker.sh  # Add user to docker group
```

## Services

| Service | Container Name | Port |
|---------|---------------|------|
| Milvus | milvus-standalone | 19530 |
| Ollama | ollama | 11434 |
| PostgreSQL | postgres | 5432 |
| pgAdmin | pgadmin | 5050 |
| Redis | redis | 6379 |
| Nginx | nginx | 80 |
| OpenWebUI | open-webui | 3000 |

## Usage

### Add user to docker group

```bash
./add-user-to-docker.sh
```

Then log out and back in.

### Start all services

```bash
sudo ./start.sh
```

### Stop all services

```bash
sudo ./stop.sh
```

### Restart all services

```bash
sudo ./restart.sh
```

### Rebuild containers

```bash
sudo ./rebuild.sh
```

### Start individual service

```bash
docker compose -f 01-milvus.yml up -d
```

### View logs

```bash
docker logs neo-milvus-standalone
docker logs -f neo-milvus-standalone
```

## Access Points

- Frontend: http://localhost:5173
- Backend: http://localhost:8000
- Milvus: http://localhost:19530
- pgAdmin: http://localhost:5050 (admin@admin.com / admin123)
- OpenWebUI: http://localhost:3000
- Nginx: http://localhost:80

## Notes

- All services connect via `neo-network` bridge network
- GPU services (Milvus, Ollama) require NVIDIA drivers and Nvidia Container Toolkit
- Services start in order with health checks
- Use `sudo` when running scripts as they require docker permissions

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
