# AI Knowledge Backend

Express.js backend for AI Knowledge Base Q&A Platform with Coze API integration.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment:
   ```bash
   # Edit .env with your database and Coze API credentials
   ```

3. Set up database:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. Start development server:
   ```bash
   npm run dev
   ```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/kb` | List knowledge bases |
| POST | `/api/kb` | Create knowledge base |
| PATCH | `/api/kb/:id` | Update knowledge base |
| DELETE | `/api/kb/:id` | Delete knowledge base |
| GET | `/api/documents?kbId=xxx` | List documents |
| POST | `/api/documents` | Create document |
| DELETE | `/api/documents/:id` | Delete document |
| GET | `/api/conversations?kbId=xxx` | List conversations |
| POST | `/api/conversations` | Create conversation |
| GET | `/api/conversations/:id` | Get conversation with messages |
| DELETE | `/api/conversations/:id` | Delete conversation |
| POST | `/api/chat` | Send message (SSE stream) |

## Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/ai_knowledge"

# Coze API
COZE_API_KEY="your_coze_api_key"
COZE_BASE_URL="https://api.coze.com"
COZE_BOT_ID="your_default_bot_id"
DEFAULT_USER_ID="default_user"

# Server
PORT=3001
CORS_ORIGIN="http://localhost:3000"
```
