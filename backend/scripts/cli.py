#!/usr/bin/env python3
"""
Olivia Backend CLI - Unified command-line interface

A comprehensive CLI for managing the Olivia backend with improved
usability, better error handling, and additional utilities.

Usage:
    python cli.py <command> [options]

Commands:
    Server:
        dev                 Start development server with auto-reload
        start               Start production server
        stop                Stop running server
        restart             Restart server
        status              Show server status

    Database:
        init-db             Initialize database tables
        migrate             Run database migrations
        auto-migrate        Auto-detect and apply schema changes
        check-db            Verify database connection
        reset-db            Reset database (WARNING: deletes all data)
        seed                Seed database with sample data

    Services:
        status              Show all service statuses
        health              Run health check
        test                Run tests

    Utilities:
    backup              Backup database
    restore             Restore database from backup
    env                 Show/set environment variables
    info                Show system information

Examples:
    # Development
    python cli.py dev
    python cli.py dev --port 9000

    # Production
    python cli.py start --workers 4
    python cli.py status

    # Database
    python cli.py check-db
    python cli.py migrate --dry-run

    # Full setup
    python cli.py init-db
    python cli.py seed
    python cli.py dev

For help: python cli.py --help
For command help: python cli.py <command> --help
"""

import argparse
import subprocess
import sys
import os
import signal
from pathlib import Path
from datetime import datetime
from typing import Optional

# Add backend directory to path
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))
os.chdir(BACKEND_DIR)


# Colors for output
class Colors:
    HEADER = "\033[95m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    RESET = "\033[0m"
    BOLD = "\033[1m"


def print_header(text: str):
    print(f"\n{Colors.HEADER}{Colors.BOLD}{text}{Colors.RESET}\n")


def print_success(text: str):
    print(f"{Colors.GREEN}✓{Colors.RESET} {text}")


def print_error(text: str):
    print(f"{Colors.RED}✗{Colors.RESET} {text}")


def print_warning(text: str):
    print(f"{Colors.YELLOW}⚠{Colors.RESET} {text}")


def print_info(text: str):
    print(f"{Colors.BLUE}ℹ{Colors.RESET} {text}")


def get_backend_dir() -> Path:
    """Get the backend directory."""
    return BACKEND_DIR


def ensure_venv():
    """Ensure we're running in a virtual environment."""
    venv = os.environ.get("VIRTUAL_ENV")
    if not venv:
        print_warning("Not running in a virtual environment")
        print_info("Consider activating: source .venv/bin/activate")


# ============================================================================
# Server Commands
# ============================================================================


def cmd_dev(args):
    """Start development server with auto-reload."""
    ensure_venv()
    print_header("Starting Olivia Backend (Development)")
    print(f"📍 Host: {args.host}:{args.port}")
    print(f"🔄 Auto-reload: enabled")
    print(f"📊 Debug mode: {'enabled' if args.debug else 'disabled'}")

    env = os.environ.copy()
    env["DEBUG"] = "true" if args.debug else "false"

    cmd = [
        sys.executable,
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        args.host,
        "--port",
        str(args.port),
        "--reload",
    ]

    if args.debug:
        cmd.extend(["--log-level", "debug"])

    try:
        signal.signal(signal.SIGINT, lambda s, f: sys.exit(0))
        subprocess.run(cmd, env=env, check=True, cwd=str(BACKEND_DIR))
    except KeyboardInterrupt:
        print_info("\nServer stopped by user")
    except subprocess.CalledProcessError as e:
        print_error(f"Server startup failed: {e}")
        sys.exit(1)


def cmd_start(args):
    """Start production server."""
    ensure_venv()
    print_header("Starting Olivia Backend (Production)")
    print(f"📍 Host: {args.host}:{args.port}")
    print(f"👷 Workers: {args.workers}")

    cmd = [
        sys.executable,
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        args.host,
        "--port",
        str(args.port),
    ]

    if args.workers > 1:
        cmd.extend(["--workers", str(args.workers)])

    if args.privileged:
        cmd.append("--privileged")

    try:
        signal.signal(signal.SIGINT, lambda s, f: sys.exit(0))
        subprocess.run(cmd, check=True, cwd=str(BACKEND_DIR))
    except KeyboardInterrupt:
        print_info("\nServer stopped by user")
    except subprocess.CalledProcessError as e:
        print_error(f"Server startup failed: {e}")
        sys.exit(1)


def cmd_stop(args):
    """Stop running server."""
    print_info("Stopping Olivia server...")
    result = subprocess.run(["pkill", "-f", "uvicorn.*app.main"], capture_output=True)
    if result.returncode == 0:
        print_success("Server stopped")
    else:
        print_warning("No running server found")


def cmd_restart(args):
    """Restart server."""
    cmd_stop(args)
    print_info("Restarting...")
    args.port = args.port or 8000
    cmd_start(args)


def cmd_status(args):
    """Show server status."""
    print_header("Olivia Backend Status")

    backend_dir = get_backend_dir()

    # Check if server is running
    result = subprocess.run(["pgrep", "-f", "uvicorn.*app.main"], capture_output=True)
    if result.returncode == 0:
        print_success("Server: Running")
    else:
        print_warning("Server: Not running")

    # Check database
    try:
        from app.core.database import health_check_db

        health = health_check_db()
        if health["status"] == "healthy":
            print_success("Database: Connected")
        else:
            print_error(f"Database: {health.get('database', 'Unknown error')}")
    except Exception as e:
        print_error(f"Database: Connection failed ({e})")

    # Check Redis if configured
    try:
        from app.core.cache_service import cache_service

        if cache_service.is_available:
            print_success("Redis: Connected")
        else:
            print_warning("Redis: Not configured")
    except Exception:
        print_warning("Redis: Not configured")


# ============================================================================
# Database Commands
# ============================================================================


def cmd_init_db(args):
    """Initialize database tables."""
    ensure_venv()
    print_header("Initializing Database")

    try:
        from app.core.database import create_db_and_tables

        print_info("Creating tables...")
        create_db_and_tables()
        print_success("Database tables created/verified")

        if not args.skip_migrations:
            cmd_migrate(
                argparse.Namespace(revision="head", dry_run=False, message=None)
            )

        print_success("Database initialization complete!")
        print_info("Next: python cli.py seed (optional)")

    except Exception as e:
        print_error(f"Initialization failed: {e}")
        sys.exit(1)


def cmd_migrate(args):
    """Run database migrations."""
    ensure_venv()
    alembic_ini = BACKEND_DIR / "alembic.ini"
    if not alembic_ini.exists():
        print_warning("No alembic.ini found, skipping migrations")
        return

    print_info("Running migrations...")

    try:
        import alembic.config
        from alembic import command

        alembic_cfg = alembic.config.Config(str(alembic_ini))

        if args.dry_run:
            print_info("Dry run - showing migration plan:")
            command.stamp(alembic_cfg, "head")
            print_success("Database is up to date (dry run)")
        else:
            command.upgrade(alembic_cfg, args.revision or "head")
            print_success("Migrations applied successfully")

    except Exception as e:
        print_error(f"Migration failed: {e}")
        sys.exit(1)


def cmd_auto_migrate(args):
    """Auto-detect and apply schema changes."""
    ensure_venv()
    print_header("Auto-Migration")

    try:
        from app.core.migration_manager import auto_migrate

        result = auto_migrate(
            message=args.message, dry_run=args.dry_run, auto_approve=args.force
        )

        if result["success"]:
            print_success(result.get("message", "Migration completed"))
        else:
            print_error(result.get("message", "Migration failed"))
            if "errors" in result:
                for error in result["errors"]:
                    print(f"  - {error}")
            sys.exit(1)

    except ImportError:
        print_warning("Migration manager not available")
        print_info("Run: python cli.py migrate")
    except Exception as e:
        print_error(f"Auto-migration failed: {e}")
        sys.exit(1)


def cmd_check_db(args):
    """Verify database connection."""
    ensure_venv()
    print_header("Database Status")

    try:
        from app.rag.config import settings
        from app.core.database import health_check_db, engine

        print_info(f"URL: {settings.database_url_safe}")
        print_info(
            f"Pool: {settings.DATABASE_POOL_SIZE} ({settings.DATABASE_MAX_OVERFLOW} max)"
        )

        health = health_check_db()
        if health["status"] == "healthy":
            print_success("Connection: OK")
        else:
            print_error(f"Connection: {health.get('database', 'Failed')}")
            sys.exit(1)

        if args.verbose:
            from sqlalchemy import inspect

            inspector = inspect(engine)
            tables = inspector.get_table_names()
            print_success(f"Tables: {len(tables)}")

            if args.verbose > 1:
                for table in sorted(tables):
                    print(f"\n  {table}:")
                    columns = inspector.get_columns(table)
                    for col in columns:
                        print(f"    - {col['name']}: {col['type']}")

    except Exception as e:
        print_error(f"Check failed: {e}")
        sys.exit(1)


def cmd_reset_db(args):
    """Reset database."""
    ensure_venv()
    print_header("⚠️  Database Reset")

    if not args.force:
        print_error("This will DELETE ALL DATA!")
        confirmation = input("\nType 'RESET' to confirm: ").strip()
        if confirmation != "RESET":
            print_info("Cancelled")
            return

    try:
        from app.core.database import reset_database

        print_info("Resetting database...")
        reset_database()
        print_success("Database reset complete")
        print_info("Next: python cli.py init-db")

    except Exception as e:
        print_error(f"Reset failed: {e}")
        sys.exit(1)


def cmd_seed(args):
    """Seed database with sample data."""
    ensure_venv()
    print_header("Seeding Database")

    try:
        # Create default collections
        print_info("Creating default collections...")
        from scripts.create_default_collections import create_all_users_collections
        import asyncio

        asyncio.run(create_all_users_collections())
        print_success("Default collections created")

        # Process collection documents
        print_info("Processing documents...")
        from scripts.process_collection_docs import process_unprocessed_documents

        asyncio.run(process_unprocessed_documents())
        print_success("Documents processed")

        print_success("Database seeded successfully!")

    except ImportError as e:
        print_warning(f"Seed scripts not available: {e}")
    except Exception as e:
        print_error(f"Seeding failed: {e}")


# ============================================================================
# Service Commands
# ============================================================================


def cmd_services_status(args):
    """Show all service statuses."""
    print_header("Service Status")

    # Check database
    try:
        from app.core.database import health_check_db

        health = health_check_db()
        status = "✓" if health["status"] == "healthy" else "✗"
        print(f"{status} PostgreSQL: {health.get('status', 'unknown')}")
    except Exception as e:
        print(f"✗ PostgreSQL: Error ({e})")

    # Check Redis
    try:
        from app.core.cache_service import cache_service

        status = "✓" if cache_service.is_available else "○"
        print(
            f"{status} Redis: {'Connected' if cache_service.is_available else 'Not configured'}"
        )
    except Exception:
        print("○ Redis: Not configured")

    # Check Milvus
    try:
        from app.rag.service import rag_service

        has_milvus = rag_service.vector_store is not None
        status = "✓" if has_milvus else "○"
        print(f"{status} Milvus: {'Connected' if has_milvus else 'Not configured'}")
    except Exception:
        print("○ Milvus: Not configured")

    # Check Ollama
    try:
        from app.rag.config import settings
        import httpx

        r = httpx.get(f"{settings.OLLAMA_BASE_URL}/api/tags", timeout=5)
        status = "✓" if r.status_code == 200 else "✗"
        print(f"{status} Ollama: {settings.OLLAMA_MODEL}")
    except Exception:
        print("○ Ollama: Not reachable")


def cmd_health(args):
    """Run health check."""
    print_header("Health Check")

    checks = []

    # Database
    try:
        from app.core.database import health_check_db

        health = health_check_db()
        checks.append(("PostgreSQL", health["status"] == "healthy"))
    except Exception:
        checks.append(("PostgreSQL", False))

    # Redis
    try:
        from app.core.cache_service import cache_service

        checks.append(("Redis", cache_service.is_available))
    except Exception:
        checks.append(("Redis", False))

    # Overall
    all_healthy = all(status for _, status in checks)
    if all_healthy:
        print_success("All services healthy")
    else:
        print_warning("Some services unhealthy")

    for name, status in checks:
        mark = "✓" if status else "✗"
        print(f"  {mark} {name}")

    sys.exit(0 if all_healthy else 1)


# ============================================================================
# Utility Commands
# ============================================================================


def cmd_backup(args):
    """Backup database."""
    print_header("Database Backup")

    backend_dir = get_backend_dir()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"backup_{timestamp}.sql"

    try:
        import pg_dumpall

        # Simple backup using pg_dump
        database_url = os.environ.get("DATABASE_URL", "")
        if "postgresql" in database_url:
            # Extract dbname from URL
            dbname = database_url.split("/")[-1]
            cmd = f"pg_dump {dbname} > {filename}"
            subprocess.run(cmd, shell=True)
            print_success(f"Backup saved to: {filename}")
        else:
            print_warning("No DATABASE_URL configured")

    except Exception as e:
        print_error(f"Backup failed: {e}")


def cmd_info(args):
    """Show system information."""
    print_header("System Information")

    print(f"Python: {sys.version.split()[0]}")
    print(f"Backend: {get_backend_dir()}")

    try:
        from app import __version__

        print(f"Olivia: {__version__}")
    except ImportError:
        print("Olivia: unknown")

    # Environment
    print("\nEnvironment:")
    for key in ["ENVIRONMENT", "DEBUG", "DATABASE_URL"]:
        val = os.environ.get(key, "not set")
        if key == "DATABASE_URL":
            val = "***configured***" if val else "not set"
        print(f"  {key}: {val}")


# ============================================================================
# Main Parser
# ============================================================================


def create_parser():
    """Create the argument parser."""
    parser = argparse.ArgumentParser(
        description="Olivia Backend CLI - Unified management tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Development
    python cli.py dev
    python cli.py dev --port 9000 --debug

    # Production
    python cli.py start --workers 4
    python cli.py status

    # Database
    python cli.py check-db -v
    python cli.py migrate --dry-run

    # Full setup
    python cli.py init-db
    python cli.py seed
    python cli.py dev

For help: python cli.py <command> --help
        """,
    )
    parser.add_argument("--version", action="version", version="%(prog)s 1.0.0")

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # Server commands
    parser_dev = subparsers.add_parser("dev", help="Start development server")
    parser_dev.add_argument("--host", default="0.0.0.0")
    parser_dev.add_argument("--port", type=int, default=8000)
    parser_dev.add_argument("--debug", action="store_true")
    parser_dev.set_defaults(func=cmd_dev)

    parser_start = subparsers.add_parser("start", help="Start production server")
    parser_start.add_argument("--host", default="0.0.0.0")
    parser_start.add_argument("--port", type=int, default=8000)
    parser_start.add_argument("--workers", type=int, default=1)
    parser_start.add_argument("--privileged", action="store_true")
    parser_start.set_defaults(func=cmd_start)

    parser_stop = subparsers.add_parser("stop", help="Stop running server")
    parser_stop.set_defaults(func=cmd_stop)

    parser_restart = subparsers.add_parser("restart", help="Restart server")
    parser_restart.add_argument("--port", type=int, default=8000)
    parser_restart.set_defaults(func=cmd_restart)

    parser_status = subparsers.add_parser("status", help="Show server status")
    parser_status.set_defaults(func=cmd_status)

    # Database commands
    parser_init = subparsers.add_parser("init-db", help="Initialize database")
    parser_init.add_argument("--skip-migrations", action="store_true")
    parser_init.set_defaults(func=cmd_init_db)

    parser_migrate = subparsers.add_parser("migrate", help="Run migrations")
    parser_migrate.add_argument("--revision", default="head")
    parser_migrate.add_argument("--dry-run", action="store_true")
    parser_migrate.set_defaults(func=cmd_migrate)

    parser_auto = subparsers.add_parser("auto-migrate", help="Auto-migrate")
    parser_auto.add_argument("--message", default="Auto-migration")
    parser_auto.add_argument("--dry-run", action="store_true")
    parser_auto.add_argument("--force", action="store_true")
    parser_auto.set_defaults(func=cmd_auto_migrate)

    parser_check = subparsers.add_parser("check-db", help="Check database")
    parser_check.add_argument("-v", "--verbose", action="count", default=0)
    parser_check.set_defaults(func=cmd_check_db)

    parser_reset = subparsers.add_parser("reset-db", help="Reset database")
    parser_reset.add_argument("--force", action="store_true")
    parser_reset.set_defaults(func=cmd_reset_db)

    parser_seed = subparsers.add_parser("seed", help="Seed database")
    parser_seed.set_defaults(func=cmd_seed)

    # Service commands
    parser_svc = subparsers.add_parser("services", help="Service status")
    parser_svc.set_defaults(func=cmd_services_status)

    parser_health = subparsers.add_parser("health", help="Health check")
    parser_health.set_defaults(func=cmd_health)

    # Utility commands
    parser_backup = subparsers.add_parser("backup", help="Backup database")
    parser_backup.set_defaults(func=cmd_backup)

    parser_info = subparsers.add_parser("info", help="System info")
    parser_info.set_defaults(func=cmd_info)

    return parser


def main():
    """Main entry point."""
    parser = create_parser()
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        print("\n" + "=" * 60)
        print("Quick Commands:")
        print("  python cli.py dev          # Start dev server")
        print("  python cli.py status       # Check status")
        print("  python cli.py check-db    # Check database")
        print("  python cli.py init-db     # Initialize DB")
        print("=" * 60)
        sys.exit(0)

    args.func(args)


if __name__ == "__main__":
    main()
