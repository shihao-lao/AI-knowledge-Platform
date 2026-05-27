# Coze Backend Design Spec

## Overview

Build a standalone Express.js backend that integrates with Coze API to provide knowledge base and AI conversation functionality for the AI Knowledge Base Q&A platform.

**Phase 1 (Current):** Conversation API integration with Coze
**Phase 2 (Future):** Knowledge base management via Coze API

## Tech Stack

- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL with Prisma ORM
- **AI Integration:** Coze official SDK (`@coze/api`)
- **CORS:** Enabled for frontend at `http://localhost:3000`

## Project Structure

```
backend/
├── package.json
├── tsconfig.json
├── prisma/
│   └── schema.prisma
├── src/
│   ├── index.ts
│   ├── config/
│   │   └── index.ts
│   ├── routes/
│   │   ├── kb.ts
│   │   ├── documents.ts
│   │   ├── conversations.ts
│   │   └── chat.ts
│   ├── services/
│   │   ├── coze.ts
│   │   ├── kb.ts
│   │   ├── documents.ts
│   │   └── chat.ts
│   ├── middleware/
│   │   └── error.ts
│   └── utils/
│       └── response.ts
├── .env
└── README.md
```

## Database Schema

### KnowledgeBase

```prisma
model KnowledgeBase {
  id          String   @id @default(uuid())
  name        String
  description String?
  visibility  String   @default("private")
  cozeBotId   String?
  
  documents      Document[]
  conversations  Conversation[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Document

```prisma
model Document {
  id              String  @id @default(uuid())
  knowledgeBaseId String
  title           String
  fileName        String
  fileType        String
  fileSize        Int
  status          String  @default("uploading")
  content         String?
  chunkCount      Int     @default(0)
  
  knowledgeBase KnowledgeBase @relation(fields: [knowledgeBaseId], references: [id])
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Conversation

```prisma
model Conversation {
  id              String  @id @default(uuid())
  knowledgeBaseId String
  title           String?
  messageCount    Int     @default(0)
  
  knowledgeBase KnowledgeBase @relation(fields: [knowledgeBaseId], references: [id])
  messages      Message[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Message

```prisma
model Message {
  id              String  @id @default(uuid())
  conversationId  String
  role            String
  content         String
  cozeMessageId   String?
  
  conversation Conversation @relation(fields: [conversationId], references: [id])
  
  createdAt DateTime @default(now())
}
```

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/kb` | List all knowledge bases |
| POST | `/api/kb` | Create knowledge base |
| PATCH | `/api/kb/:id` | Update knowledge base |
| DELETE | `/api/kb/:id` | Delete knowledge base |
| GET | `/api/documents?kbId=xxx` | List documents by KB |
| POST | `/api/documents` | Upload document |
| DELETE | `/api/documents/:id` | Delete document |
| GET | `/api/conversations?kbId=xxx` | List conversations |
| POST | `/api/conversations` | Create conversation |
| GET | `/api/conversations/:id` | Get conversation with messages |
| DELETE | `/api/conversations/:id` | Delete conversation |
| POST | `/api/chat` | Send message (SSE stream) |

### Response Format

```typescript
interface ApiResponse<T> {
  code: number;    // 0 = success, 1 = error
  data: T;
  message?: string;
}
```

### Chat Route (SSE)

**Request:**
```typescript
POST /api/chat
Body: {
  conversationId: string;
  content: string;
}
```

**Response:** Server-Sent Events stream
```
data: {"content": "Hello", "done": false}
data: {"content": " world", "done": false}
data: {"content": "", "done": true}
```

## Coze API Integration

### SDK Setup

```typescript
import { CozeAPI, RoleType } from '@coze/api';

const coze = new CozeAPI({
  token: process.env.COZE_API_KEY,
  baseURL: process.env.COZE_BASE_URL || 'https://api.coze.com',
});
```

### Chat Flow

1. User sends message to `POST /api/chat`
2. Load conversation history from PostgreSQL
3. Get bot ID from knowledge base's `cozeBotId` field
4. Call Coze API with streaming enabled
5. Stream response back to frontend via SSE
6. Save both user and assistant messages to database

### User Identification

Since there's no auth system in Phase 1, use a default user ID:
- Default user ID: `"default_user"` (can be enhanced with auth later)
- Each request can optionally pass `userId` in header or body

### Coze API Call

```typescript
const stream = await coze.chat({
  bot_id: knowledgeBase.cozeBotId,  // From KB record
  user_id: userId,                   // Default or from request
  stream: true,
  auto_save_history: true,
  additional_messages: history.map(m => ({
    role: m.role === 'user' ? RoleType.User : RoleType.Assistant,
    content: m.content,
    content_type: 'text',
  })),
});
```

## Error Handling

### Middleware

```typescript
export function errorHandler(err, req, res, next) {
  console.error(err.stack);
  
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(status).json({
    code: 1,
    data: null,
    message,
  });
}
```

### Common Errors

| Error | Status | Description |
|-------|--------|-------------|
| Missing required fields | 400 | Request body missing required fields |
| Conversation not found | 404 | Conversation ID doesn't exist |
| Coze API error | 502 | Upstream Coze API failed |
| Database error | 500 | PostgreSQL connection or query error |

## Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/ai_knowledge"

# Coze API
COZE_API_KEY="your_coze_api_key"
COZE_BASE_URL="https://api.coze.com"
COZE_BOT_ID="your_default_bot_id"  # Fallback if KB has no cozeBotId
DEFAULT_USER_ID="default_user"     # Default user for Phase 1 (no auth)

# Server
PORT=3001
CORS_ORIGIN="http://localhost:3000"
```

## Frontend Integration

### API Base URL Update

```typescript
// lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
```

### Fetch Calls Update

```typescript
// Before: fetch('/api/kb')
// After:  fetch(`${API_BASE}/api/kb`)
```

### Streaming

- Current frontend uses SSE for chat
- Backend returns the same SSE format
- No changes needed for chat streaming logic

## Dependencies

### package.json

```json
{
  "name": "ai-knowledge-backend",
  "version": "1.0.0",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev"
  },
  "dependencies": {
    "@coze/api": "^1.0.0",
    "@prisma/client": "^6.0.0",
    "cors": "^2.8.5",
    "express": "^4.21.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "prisma": "^6.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0"
  }
}
```

## Implementation Order

1. **Setup project** - Initialize Express.js project with TypeScript
2. **Database** - Set up Prisma with PostgreSQL schema
3. **Basic routes** - CRUD for knowledge bases, documents, conversations
4. **Coze integration** - Chat route with streaming
5. **Error handling** - Middleware and error responses
6. **Frontend update** - Update API base URL in frontend

## Future Enhancements (Phase 2)

- Coze knowledge base management API
- Document upload to Coze
- Bot creation and management
- Webhook support for real-time updates
