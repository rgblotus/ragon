# Olivia API Test Suite

This test script tests all API endpoints using the credentials `abc@abc.com` / `abc123`.

## Setup

Install the required dependency:

```bash
pip install aiohttp
```

## Running the Tests

```bash
# From the backend directory
python tests/test_api.py

# Or if using a virtual environment
source venv/bin/activate
python tests/test_api.py
```

## Tested Endpoints

### Health Endpoints
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health check with component status
- `GET /` - Root endpoint with API info

### Authentication Endpoints
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login and get JWT token
- `GET /auth/me` - Get current user profile
- `PUT /auth/me` - Update user profile

### User Settings Endpoints
- `GET /auth/settings` - Get user AI settings
- `PUT /auth/settings` - Update user settings
- `POST /auth/settings/reset` - Reset settings to defaults

### Collection Endpoints
- `GET /collections/` - List user collections
- `POST /collections/` - Create new collection
- `GET /collections/{id}` - Get collection details
- `DELETE /collections/{id}` - Delete collection

### Document Endpoints
- `GET /documents/` - List user documents
- `POST /documents/upload` - Upload new document
- `DELETE /documents/{id}` - Delete document
- `GET /documents/{id}/content` - Get document content
- `GET /documents/{id}/vectors` - Get document vector visualization
- `GET /documents/{id}/stats` - Get document statistics

### Chat Endpoints
- `GET /chat/sessions` - List chat sessions
- `POST /chat/sessions` - Create chat session
- `GET /chat/sessions/{id}` - Get session with messages
- `PUT /chat/sessions/{id}` - Update session
- `DELETE /chat/sessions/{id}` - Delete session
- `GET /chat/sessions/{id}/messages` - Get session messages
- `POST /chat/sessions/{id}/messages` - Create message
- `DELETE /chat/messages/{id}` - Delete message

### RAG Endpoints
- `POST /rag/chat` - Stream chat with documents
- `GET /rag/debug/documents` - Debug vector store
- `POST /rag/sources` - Get sources without AI response
- `POST /rag/translate` - Translate text
- `POST /rag/tts` - Text-to-speech

### Cache Endpoints
- `GET /rag/cache/stats` - Cache statistics
- `GET /rag/cache/health` - Cache health status
- `POST /rag/cache/warmup` - Trigger cache warmup

## Test Credentials

The test script uses:
- **Email:** `abc@abc.com`
- **Password:** `abc123`

## Output

The script provides:
- Timestamped logs for each test
- Pass/fail indicators (✓/✗)
- Summary with total passed/failed tests
- Cleanup of test data (sessions, collections) after tests
