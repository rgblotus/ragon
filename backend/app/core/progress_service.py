import asyncio
import logging
import time
from typing import Dict, List
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class ProgressService:
    """Service for managing WebSocket connections and emitting progress events."""

    def __init__(self):
        self.connections: Dict[int, List[WebSocket]] = {}  # user_id -> list of websockets

    def add_connection(self, user_id: int, websocket: WebSocket):
        """Add a WebSocket connection for a user."""
        if user_id not in self.connections:
            self.connections[user_id] = []
        self.connections[user_id].append(websocket)
        logger.debug(f"Added WebSocket connection for user {user_id}")

    def remove_connection(self, user_id: int, websocket: WebSocket):
        """Remove a WebSocket connection for a user."""
        if user_id in self.connections:
            try:
                self.connections[user_id].remove(websocket)
                logger.debug(f"Removed WebSocket connection for user {user_id}")
                if not self.connections[user_id]:
                    del self.connections[user_id]
            except ValueError:
                pass  # WebSocket not in list

    async def emit_progress(self, user_id: int, progress: int, message: str, task_id: str = None):
        """Emit a progress event to all connections for a user."""
        # Store progress in Redis for polling fallback
        if task_id:
            from app.core.cache_service import cache_service
            progress_data = {
                "progress": progress,
                "message": message,
                "isProcessing": progress < 100,
                "timestamp": time.time()
            }
            cache_service.set(f"progress:{task_id}", progress_data, ttl=300)  # 5 min TTL

        if user_id not in self.connections:
            return

        event = {
            "type": "progress",
            "progress": progress,
            "message": message,
            "task_id": task_id
        }

        disconnected = []
        for websocket in self.connections[user_id]:
            try:
                await websocket.send_json(event)
            except Exception as e:
                # Check if this is an expected WebSocket close
                if hasattr(e, 'code') and e.code in [1000, 1001, 1006, 1012]:
                    logger.debug(f"WebSocket closed normally while sending progress for user {user_id} (code: {e.code})")
                else:
                    logger.debug(f"Failed to send progress to WebSocket for user {user_id}: {e}")
                disconnected.append(websocket)

        # Remove disconnected websockets
        for ws in disconnected:
            self.remove_connection(user_id, ws)

# Global instance
progress_service = ProgressService()