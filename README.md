# Ragon - RAG System

A Retrieval-Augmented Generation (RAG) system with document processing, chat, and AI-powered search capabilities.

## 1. Project Structure

```
/Users/neo/Ant/ragon/
├── docker/                          # Docker services configuration
│   ├── 01-milvus.yml               # Milvus vector database
│   ├── 02-ollama.yml               # Ollama LLM service
│   ├── 03-postgres.yml            # PostgreSQL database
│   ├── 05-pgadmin.yml             # pgAdmin database UI
│   ├── 06-nginx.yml               # Nginx reverse proxy
│   ├── 07-redis.yml               # Redis cache
│   ├── nginx.conf                 # Nginx configuration
│   ├── redis.conf                 # Redis configuration
│   ├── start.sh                   # Start all docker services
│   ├── stop.sh                    # Stop all docker services
│   ├── restart.sh                 # Restart docker services
│   ├── rebuild.sh                 # Rebuild and restart services
│   └── add-user-to-docker.sh      # Add user to docker group
│
├── backend/                        # Python FastAPI backend
│   ├── app/
│   │   ├── auth/                  # Authentication module
│   │   ├── chat/                  # Chat functionality
│   │   ├── collection/           # Document collections
│   │   ├── core/                 # Core utilities (database, cache, security)
│   │   ├── document/             # Document processing
│   │   └── rag/                  # RAG engine (embeddings, retrieval, chains)
│   ├── scripts/
│   │   ├── download_models.py    # Download AI models
│   │   └── cli.py                # CLI for backend management
│   ├── alembic/                  # Database migrations
│   └── pyproject.toml            # Python dependencies
│
└── frontend/                      # React frontend application
    ├── src/
    │   ├── components/
    │   │   ├── chat/             # Chat UI components
    │   │   ├── documents/       # Document management components
    │   │   ├── ui/              # Reusable UI components
    │   │   ├── webGL/           # WebGL visualizations
    │   │   └── layout/          # Layout components
    │   └── contexts/            # React contexts (Auth, Progress)
    └── vite.config.ts           # Vite configuration
```

## 2. Tools Required

- **Docker** - Container orchestration
- **Nvidia Container Toolkit** - GPU support for Docker
- **Git** - Version control
- **cURL/wget** - HTTP utilities
- **Python 3.11+** - Backend runtime
- **Node.js 18+** - Frontend runtime
- **uv** - Python package manager

## 3. Docker Setup

Start all required infrastructure services:

```bash
cd docker
sudo ./start.sh
```

Other docker commands:
```bash
sudo ./stop.sh        # Stop all services
sudo ./restart.sh     # Restart all services
sudo ./rebuild.sh     # Rebuild containers
```

**Access Points:**
- Frontend: http://localhost:5173
- Backend: http://localhost:8000
- Milvus: http://localhost:19530
- pgAdmin: http://localhost:5050
- OpenWebUI: http://localhost:3000
- Nginx: http://localhost:80

## 4. Backend Setup

### Download AI Models

```bash
cd backend
python scripts/download_models.py
```

This downloads:
- **Embedding**: sentence-transformers/all-MiniLM-L6-v2
- **Voice**: kakao-enterprise/vits-ljs
- **Translation**: Helsinki-NLP/opus-mt-en-hi

Models are saved to `backend/models/`

### Start Backend

```bash
cd backend
uv run python ./scripts/cli.py dev
```

## 5. Frontend Setup

### Install Dependencies

```bash
cd frontend
npm install
```

### Run Frontend

```bash
cd frontend
npm run dev
```

The frontend will be available at http://localhost:5173
