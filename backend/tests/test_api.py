#!/usr/bin/env python3
"""
Olivia API Test Script
Tests all API endpoints using credentials: abc@abc.com / abc123
"""

import asyncio
import aiohttp
import sys
from datetime import datetime
from typing import Optional

# Test credentials
TEST_EMAIL = "abc@abc.com"
TEST_PASSWORD = "abc123"
BASE_URL = "http://localhost:8000"

# Colors for terminal output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"
BOLD = "\033[1m"


class APITester:
    def __init__(self, base_url: str, email: str, password: str):
        self.base_url = base_url
        self.email = email
        self.password = password
        self.token: Optional[str] = None
        self.user_id: Optional[int] = None
        self.session: Optional[aiohttp.ClientSession] = None
        self.results = []

    def log(self, message: str, color: str = RESET):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"{color}[{timestamp}] {message}{RESET}")

    def log_result(self, endpoint: str, status: int, success: bool):
        symbol = "✓" if success else "✗"
        color = GREEN if success else RED
        self.results.append(
            {"endpoint": endpoint, "status": status, "success": success}
        )
        self.log(f"{symbol} {endpoint} - Status: {status}", color)

    async def setup(self):
        """Initialize aiohttp session."""
        self.session = aiohttp.ClientSession(
            headers={"Content-Type": "application/json"}
        )
        self.log("Initialized test session", BLUE)

    async def teardown(self):
        """Close aiohttp session."""
        if self.session:
            await self.session.close()
            self.log("Closed test session", BLUE)

    async def request(
        self,
        method: str,
        endpoint: str,
        data: dict = None,
        use_auth: bool = True,
    ) -> tuple:
        """Make an API request."""
        url = f"{self.base_url}{endpoint}"
        headers = {}
        if self.token and use_auth:
            headers["Authorization"] = f"Bearer {self.token}"

        try:
            if method.upper() == "GET":
                async with self.session.get(url, headers=headers) as resp:
                    text = await resp.text()
                    try:
                        json_data = await resp.json()
                    except:
                        json_data = text
                    return resp.status, json_data
            elif method.upper() == "POST":
                async with self.session.post(url, json=data, headers=headers) as resp:
                    text = await resp.text()
                    try:
                        json_data = await resp.json()
                    except:
                        json_data = text
                    return resp.status, json_data
            elif method.upper() == "PUT":
                async with self.session.put(url, json=data, headers=headers) as resp:
                    text = await resp.text()
                    try:
                        json_data = await resp.json()
                    except:
                        json_data = text
                    return resp.status, json_data
            elif method.upper() == "DELETE":
                async with self.session.delete(url, headers=headers) as resp:
                    text = await resp.text()
                    try:
                        json_data = await resp.json()
                    except:
                        json_data = text
                    return resp.status, json_data
        except Exception as e:
            return 0, {"error": str(e)}

    async def test_health_endpoints(self):
        """Test health check endpoints."""
        self.log("\n" + BOLD + "Testing Health Endpoints" + RESET, BLUE)

        # Basic health check
        status, data = await self.request("GET", "/health")
        self.log_result("GET /health", status, status == 200)
        if status == 200:
            self.log(f"  Version: {data.get('version', 'unknown')}", GREEN)

        # Detailed health check
        status, data = await self.request("GET", "/health/detailed")
        self.log_result("GET /health/detailed", status, status == 200)

        # Root endpoint
        status, data = await self.request("GET", "/")
        self.log_result("GET / (root)", status, status == 200)

    async def test_auth_endpoints(self):
        """Test authentication endpoints."""
        self.log("\n" + BOLD + "Testing Authentication Endpoints" + RESET, BLUE)

        # Register new user
        register_data = {
            "email": self.email,
            "password": self.password,
            "full_name": "Test User",
        }
        status, data = await self.request("POST", "/auth/register", register_data)
        self.log_result("POST /auth/register", status, status in [200, 400])
        if status == 200:
            self.user_id = data.get("id")
            self.log(f"  User ID: {self.user_id}", GREEN)

        # Login
        login_data = {"email": self.email, "password": self.password}
        status, data = await self.request("POST", "/auth/login", login_data)
        self.log_result("POST /auth/login", status, status == 200)
        if status == 200:
            self.token = data.get("access_token")
            self.log(f"  Token received: {self.token[:20]}...", GREEN)

        # Get current user (requires auth)
        status, data = await self.request("GET", "/auth/me")
        self.log_result("GET /auth/me", status, status == 200)
        if status == 200:
            self.log(f"  User: {data.get('email')}", GREEN)

        # Update user
        update_data = {"full_name": "Updated User"}
        status, data = await self.request("PUT", "/auth/me", update_data)
        self.log_result("PUT /auth/me", status, status == 200)

    async def test_user_settings(self):
        """Test user settings endpoints."""
        self.log("\n" + BOLD + "Testing User Settings Endpoints" + RESET, BLUE)

        # Get settings
        status, data = await self.request("GET", "/auth/settings")
        self.log_result("GET /auth/settings", status, status == 200)

        # Update settings
        settings_data = {
            "default_temperature": 0.5,
            "default_top_k": 10,
            "theme": "dark",
        }
        status, data = await self.request("PUT", "/auth/settings", settings_data)
        self.log_result("PUT /auth/settings", status, status == 200)

        # Reset settings
        status, data = await self.request("POST", "/auth/settings/reset")
        self.log_result("POST /auth/settings/reset", status, status == 200)

    async def test_collections(self):
        """Test collection endpoints."""
        self.log("\n" + BOLD + "Testing Collection Endpoints" + RESET, BLUE)

        # List collections
        status, data = await self.request("GET", "/collections/")
        self.log_result("GET /collections/", status, status == 200)
        collections = data if isinstance(data, list) else data.get("collections", [])
        self.log(f"  Found {len(collections)} collections", GREEN)

        # Create collection
        col_data = {
            "name": "Test Collection",
            "description": "Created by test script",
        }
        status, data = await self.request("POST", "/collections/", col_data)
        self.log_result("POST /collections/", status, status == 200)
        collection_id = data.get("id") if status == 200 else None
        if collection_id:
            self.log(f"  Created collection ID: {collection_id}", GREEN)

        # Get collection
        if collection_id:
            status, data = await self.request("GET", f"/collections/{collection_id}")
            self.log_result(f"GET /collections/{collection_id}", status, status == 200)

        # Test non-existent collection
        status, data = await self.request("GET", "/collections/99999")
        self.log_result("GET /collections/99999 (should fail)", status, status == 404)

        return collection_id

    async def test_documents(self, collection_id: int = None):
        """Test document endpoints."""
        self.log("\n" + BOLD + "Testing Document Endpoints" + RESET, BLUE)

        # List documents
        status, data = await self.request("GET", "/documents/")
        self.log_result("GET /documents/", status, status == 200)
        documents = data if isinstance(data, list) else data
        self.log(f"  Found {len(documents)} documents", GREEN)

        return documents

    async def test_chat_sessions(self):
        """Test chat session endpoints."""
        self.log("\n" + BOLD + "Testing Chat Endpoints" + RESET, BLUE)

        # List sessions
        status, data = await self.request("GET", "/chat/sessions")
        self.log_result("GET /chat/sessions", status, status == 200)
        sessions = data.get("sessions", []) if isinstance(data, dict) else []
        self.log(f"  Found {len(sessions)} chat sessions", GREEN)

        # Create session
        session_data = {
            "title": "Test Chat Session",
            "collection_id": None,
            "temperature": 0.7,
            "top_k": 5,
        }
        status, data = await self.request("POST", "/chat/sessions", session_data)
        self.log_result("POST /chat/sessions", status, status == 200)
        session_id = data.get("id") if status == 200 else None
        if session_id:
            self.log(f"  Created session ID: {session_id}", GREEN)

            # Get session
            status, data = await self.request("GET", f"/chat/sessions/{session_id}")
            self.log_result(f"GET /chat/sessions/{session_id}", status, status == 200)

            # Create message
            message_data = {"content": "Hello, this is a test!", "sender": "user"}
            status, data = await self.request(
                "POST", f"/chat/sessions/{session_id}/messages", message_data
            )
            self.log_result(
                f"POST /chat/sessions/{session_id}/messages", status, status == 200
            )

            # Get messages
            status, data = await self.request(
                "GET", f"/chat/sessions/{session_id}/messages"
            )
            self.log_result(
                f"GET /chat/sessions/{session_id}/messages", status, status == 200
            )

            return session_id

        return None

    async def test_rag_endpoints(self, collection_id: int = None):
        """Test RAG endpoints."""
        self.log("\n" + BOLD + "Testing RAG Endpoints" + RESET, BLUE)

        # Get sources
        if collection_id:
            source_data = {
                "query": "test query",
                "collection_id": collection_id,
                "temperature": 0.7,
                "top_k": 5,
            }
            status, data = await self.request("POST", "/rag/sources", source_data)
            self.log_result("POST /rag/sources", status, status == 200)

        # Debug documents (requires RAG service)
        status, data = await self.request("GET", "/rag/debug/documents")
        self.log_result("GET /rag/debug/documents", status, status in [200, 500])

    async def test_cache_endpoints(self):
        """Test cache monitoring endpoints."""
        self.log("\n" + BOLD + "Testing Cache Endpoints" + RESET, BLUE)

        # Get cache stats
        status, data = await self.request("GET", "/rag/cache/stats")
        self.log_result("GET /rag/cache/stats", status, status == 200)

        # Get cache health
        status, data = await self.request("GET", "/rag/cache/health")
        self.log_result("GET /rag/cache/health", status, status == 200)

    async def test_translation(self):
        """Test translation endpoint."""
        self.log("\n" + BOLD + "Testing Translation Endpoint" + RESET, BLUE)

        trans_data = {"text": "Hello, world!"}
        status, data = await self.request("POST", "/rag/translate", trans_data)
        self.log_result("POST /rag/translate", status, status == 200)

    async def test_performance_endpoints(self):
        """Test performance monitoring."""
        self.log("\n" + BOLD + "Testing Performance Endpoints" + RESET, BLUE)

        status, data = await self.request("GET", "/performance")
        self.log_result("GET /performance", status, status == 200)

    async def run_all_tests(self):
        """Run all tests."""
        print("\n" + BOLD + "=" * 50)
        print("  Olivia API Test Suite")
        print(f"  User: {self.email}")
        print(f"  Base URL: {self.base_url}")
        print("=" * 50 + RESET + "\n")

        await self.setup()

        try:
            # Health checks (no auth required)
            await self.test_health_endpoints()

            # Auth endpoints
            await self.test_auth_endpoints()

            if not self.token:
                self.log(
                    "\n"
                    + RED
                    + "Authentication failed! Skipping protected endpoints."
                    + RESET
                )
                return self.results

            # Protected endpoints
            await self.test_user_settings()
            collection_id = await self.test_collections()
            await self.test_documents(collection_id)
            session_id = await self.test_chat_sessions()
            await self.test_rag_endpoints(collection_id)
            await self.test_cache_endpoints()
            await self.test_translation()
            await self.test_performance_endpoints()

            # Cleanup - delete test session
            if session_id:
                status, _ = await self.request("DELETE", f"/chat/sessions/{session_id}")
                self.log(f"Cleaned up test session {session_id}", YELLOW)

            # Cleanup - delete test collection
            if collection_id:
                status, _ = await self.request(
                    "DELETE", f"/collections/{collection_id}"
                )
                self.log(f"Cleaned up test collection {collection_id}", YELLOW)

        finally:
            await self.teardown()

        # Summary
        self.print_summary()

        return self.results

    def print_summary(self):
        """Print test summary."""
        print("\n" + BOLD + "=" * 50)
        print("  Test Summary")
        print("=" * 50 + RESET)

        passed = sum(1 for r in self.results if r["success"])
        failed = sum(1 for r in self.results if not r["success"])
        total = len(self.results)

        self.log(f"Total: {total}", BLUE)
        self.log(f"Passed: {passed}", GREEN)
        self.log(f"Failed: {failed}", RED if failed else GREEN)

        if failed > 0:
            print("\n" + RED + "Failed endpoints:" + RESET)
            for r in self.results:
                if not r["success"]:
                    print(f"  - {r['endpoint']} (Status: {r['status']})")

        print()


async def main():
    """Main entry point."""
    tester = APITester(BASE_URL, TEST_EMAIL, TEST_PASSWORD)
    results = await tester.run_all_tests()

    # Exit with appropriate code
    failed = sum(1 for r in results if not r["success"])
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    asyncio.run(main())
