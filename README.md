# Ragon - RAG System

A Retrieval-Augmented Generation (RAG) system with document processing, chat, and AI-powered search capabilities.

## 1. Project Structure

```
/Users/neo/Ant/ragon/
├── LICENSE                           # Project license
├── architecture.mmd                  # Architecture diagram (Mermaid)
├── README.md                         # Project documentation
│
├── docker/                           # Docker services configuration
│   ├── 01-milvus.yml                # Milvus vector database
│   ├── 02-ollama.yml                # Ollama LLM service
│   ├── 03-postgres.yml              # PostgreSQL database
│   ├── 04-open-webui.yml            # Open WebUI interface
│   ├── 05-pgadmin.yml               # pgAdmin database UI
│   ├── 06-nginx.yml                 # Nginx reverse proxy
│   ├── 07-redis.yml                 # Redis cache
│   ├── nginx.conf                   # Nginx configuration
│   ├── redis.conf                   # Redis configuration
│   ├── start.sh                     # Start all docker services
│   ├── stop.sh                      # Stop all docker services
│   ├── restart.sh                   # Restart docker services
│   ├── rebuild.sh                   # Rebuild and restart services
│   ├── add-user-to-docker.sh        # Add user to docker group
│   └── ollama/
│       └── entrypoint.sh            # Ollama entrypoint script
│
├── backend/                          # Python FastAPI backend
│   ├── .env                         # Environment variables
│   ├── .python-version              # Python version
│   ├── pyproject.toml               # Python dependencies
│   ├── uv.lock                      # uv lock file
│   ├── alembic.ini                  # Alembic configuration
│   ├── README.md                    # Backend documentation
│   │
│   ├── app/                         # Main application
│   │   ├── __init__.py
│   │   ├── main.py                  # FastAPI application entry point
│   │   │
│   │   ├── auth/                    # Authentication module
│   │   │   ├── __init__.py
│   │   │   ├── models.py            # Auth models
│   │   │   ├── router.py            # Auth routes
│   │   │   └── schemas.py          # Auth schemas
│   │   │
│   │   ├── chat/                    # Chat functionality
│   │   │   ├── models.py            # Chat models
│   │   │   ├── router.py            # Chat routes
│   │   │   └── schemas.py           # Chat schemas
│   │   │
│   │   ├── collection/              # Document collections
│   │   │   ├── models.py            # Collection models
│   │   │   ├── router.py            # Collection routes
│   │   │   └── schemas.py           # Collection schemas
│   │   │
│   │   ├── core/                    # Core utilities
│   │   │   ├── __init__.py
│   │   │   ├── cache_monitor.py     # Cache monitoring
│   │   │   ├── cache_service.py    # Redis cache service
│   │   │   ├── database.py          # Database connection
│   │   │   ├── exceptions.py       # Custom exceptions
│   │   │   ├── logging_config.py   # Logging configuration
│   │   │   ├── middleware.py       # Middleware
│   │   │   ├── migration_manager.py # Database migrations
│   │   │   ├── progress_service.py # Progress tracking
│   │   │   ├── router.py            # Core routes
│   │   │   ├── security.py          # Security utilities
│   │   │   └── service_manager.py  # Service management
│   │   │
│   │   ├── document/                # Document processing
│   │   │   ├── models.py            # Document models
│   │   │   ├── router.py            # Document routes
│   │   │   └── schemas.py           # Document schemas
│   │   │
│   │   └── rag/                     # RAG engine
│   │       ├── __init__.py
│   │       ├── config.py            # RAG configuration
│   │       ├── router.py            # RAG routes
│   │       ├── schemas.py           # RAG schemas
│   │       ├── service.py          # RAG service
│   │       ├── utils.py            # RAG utilities
│   │       ├── visualization.py    # Vector visualization
│   │       │
│   │       ├── helpers/
│   │       │   ├── __init__.py
│   │       │   └── embeddings.py   # Embedding helpers
│   │       │
│   │       ├── processors/
│   │       │   ├── __init__.py
│   │       │   └── processor.py    # Document processor
│   │       │
│   │       └── services/
│   │           ├── __init__.py
│   │           ├── ai_utils.py      # AI utilities
│   │           ├── chains.py        # LangChain chains
│   │           └── retrieval.py    # Retrieval service
│   │
│   ├── scripts/                     # Backend scripts
│   │   ├── cleanup_milvus.py       # Milvus cleanup script
│   │   ├── cli.py                  # CLI management tool
│   │   └── download_models.py      # Download AI models
│   │
│   └── alembic/                     # Database migrations
│       ├── env.py                  # Alembic environment
│       ├── README                  # Alembic README
│       ├── script.py.mako          # Alembic template
│       └── versions/               # Migration versions
│           └── a1b2c3d4_add_sources_to_chatmessage.py
│
└── frontend/                        # React frontend application
    ├── package.json                 # Node dependencies
    ├── package-lock.json            # Dependency lock file
    ├── tsconfig.json                # TypeScript config
    ├── tsconfig.app.json            # TypeScript app config
    ├── tsconfig.node.json           # TypeScript node config
    ├── vite.config.ts               # Vite configuration
    ├── eslint.config.js             # ESLint configuration
    ├── index.html                   # HTML entry point
    ├── README.md                    # Frontend documentation
    │
    ├── public/                      # Static public assets
    │   ├── pdf.worker.min.js       # PDF.js worker
    │   └── vite.svg                # Vite logo
    │
    ├── src/
    │   ├── main.tsx                # React entry point
    │   ├── App.tsx                 # Main App component
    │   ├── App.css                 # App styles
    │   ├── index.css               # Global styles
    │   ├── vite-env.d.ts           # Vite type definitions
    │   ├── constants.ts            # App constants
    │   │
    │   ├── assets/                 # Static assets
    │   │   └── react.svg           # React logo
    │   │
    │   ├── components/
    │   │   ├── chat/               # Chat UI components
    │   │   │   ├── AISettingsPanel.tsx
    │   │   │   ├── ChatHeader.tsx
    │   │   │   ├── ChatInput.tsx
    │   │   │   ├── ChatMessage.tsx
    │   │   │   ├── ChatMessages.tsx
    │   │   │   └── ChatSidebar.tsx
    │   │   │
    │   │   ├── documents/          # Document components
    │   │   │   ├── DocumentContentModal.tsx
    │   │   │   ├── DocumentDetailsModal.tsx
    │   │   │   ├── DocumentPreview.tsx
    │   │   │   ├── DocumentStatus.tsx
    │   │   │   └── VectorVisualizationModal.tsx
    │   │   │
    │   │   ├── layout/             # Layout components
    │   │   │   └── Layout.tsx
    │   │   │
    │   │   ├── ui/                # Reusable UI components
    │   │   │   ├── AuthModal.tsx
    │   │   │   ├── Button.tsx
    │   │   │   ├── Card.tsx
    │   │   │   ├── ErrorBoundary.tsx
    │   │   │   ├── Input.tsx
    │   │   │   ├── Loading.tsx
    │   │   │   └── ProgressBar.tsx
    │   │   │
    │   │   └── webGL/             # WebGL visualizations
    │   │       ├── ShapeGenerator.tsx
    │   │       └── WebGLBackground.tsx
    │   │
    │   ├── contexts/               # React contexts
    │   │   ├── AuthContext.tsx     # Authentication context
    │   │   └── ProgressContext.tsx # Progress tracking context
    │   │
    │   ├── hooks/                  # Custom React hooks
    │   │   ├── index.ts
    │   │   ├── useAuth.tsx
    │   │   ├── useChat.ts
    │   │   ├── useCommon.tsx
    │   │   └── useDocuments.ts
    │   │
    │   ├── pages/                  # Page components
    │   │   ├── Chat.tsx
    │   │   ├── Dashboard.tsx
    │   │   ├── DebugRAG.tsx
    │   │   ├── Documents.tsx
    │   │   ├── Landing.tsx
    │   │   └── Profile.tsx
    │   │
    │   ├── services/               # API services
    │   │   ├── api.ts              # API client
    │   │   └── progressWebSocket.ts # WebSocket for progress
    │   │
    │   ├── shaders/                # WebGL shaders
    │   │   ├── particles.frag      # Fragment shader
    │   │   └── particles.vert      # Vertex shader
    │   │
    │   ├── types/                  # TypeScript types
    │   │   └── api.ts              # API types
    │   │
    │   └── utils/                  # Utility functions
    │       ├── cn.ts               # Class name utility
    │       ├── errorHandler.ts    # Error handling
    │       ├── helpers.ts          # Helper functions
    │       ├── optimization.ts     # Performance optimization
    │       ├── shaderLoader.ts     # Shader loading
    │       ├── shapeGenerators.ts  # Shape generators
    │       └── storage.ts          # Storage utilities
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

## 4. Database Setup

```bash
cd backend
python cli.py init-db
```

This creates all database tables. No additional migration steps needed.

## 5. Backend Setup

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

## 6. Frontend Setup

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
