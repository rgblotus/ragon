# Olivia Backend

Modern AI research assistant backend with RAG capabilities.

## Quick Start

1. **Install dependencies:**

    ```bash
    pip install -e .
    ```

2. **Initialize database:**

    ```bash
    python cli.py init-db
    ```

3. **Start development server:**

    ```bash
    python cli.py dev
    ```

    The server will start on http://localhost:8000 with auto-reload enabled.

## CLI Commands

The backend uses a unified CLI for all operations:

### Development Server

```bash
# Start with auto-reload (default: 0.0.0.0:8000)
python cli.py dev

# Custom host and port
python cli.py dev --host 127.0.0.1 --port 8080
```

### Production Server

```bash
# Start production server
python cli.py start

# With multiple workers
python cli.py start --workers 4
```

### Database Management

```bash
# Initialize database tables and run migrations
python cli.py init-db

# Skip migrations (tables only)
python cli.py init-db --skip-migrations

# Check database status
python cli.py check-db

# Verbose output with table list
python cli.py check-db -v

# Extra verbose with full schema
python cli.py check-db -vv
```

### Help

```bash
# Show all available commands
python cli.py --help

# Show help for specific command
python cli.py dev --help
```

## Database

- **PostgreSQL** is the default database (configure via `DATABASE_URL`)
- **Alembic** handles schema migrations
- Tables are created via `python cli.py init-db`
- Use `python cli.py check-db` to verify connection and view tables

## API Documentation

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI**: http://localhost:8000/openapi.json

## Key Features

- **RAG Pipeline**: Document processing and Q&A
- **Vector Search**: Milvus integration for embeddings
- **Chat Sessions**: Persistent conversation history
- **Real-time Progress**: WebSocket updates for long operations
- **User Management**: Authentication and authorization

## Development

The backend uses modern Python patterns:

- **FastAPI** for the web framework
- **SQLModel** for database ORM
- **Alembic** for migrations
- **Redis** for caching (optional)
- **WebSockets** for real-time updates

python cli.py dev              # Development server
python cli.py start            # Production server
python cli.py init-db          # Initialize database
python cli.py check-db -v      # Check database status
python cli.py --help           # See all commands
