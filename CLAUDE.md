# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI 知识库智能问答平台 — an AI Knowledge Base Q&A platform built with Next.js 16 (App Router) + TypeScript. Currently a **frontend-only prototype** with no backend: all data is mocked in-memory via Zustand + `data/mock.ts`. No API routes exist.

## Commands

```bash
npm run dev          # Dev server (binds 0.0.0.0)
npm run build        # Production build
npm start            # Start production server (binds 0.0.0.0)
npm run lint         # ESLint check
npm run lint:fix     # ESLint auto-fix
npm run format       # Prettier write
npm run format:check # Prettier check
```

## Tech Stack

- **Next.js 16** App Router, React 18, TypeScript (strict)
- **Ant Design 5** (antd + @ant-design/icons) with zh_CN locale
- **Zustand 5** for state management (two stores)
- **react-markdown** + remark-gfm + rehype-prism-plus for chat message rendering
- **mammoth** (Word) and **exceljs** (Excel) for document parsing
- Path alias: `@/*` maps to project root

## Architecture

### Routing

| Route                         | Purpose                                       |
| ----------------------------- | --------------------------------------------- |
| `/`                           | Redirects to `/knowledge/:defaultKbId`        |
| `/login`, `/register`         | Auth pages                                    |
| `/knowledge/:kbId`            | Workspace in knowledge mode (3-column layout) |
| `/chat/:kbId/:conversationId` | Workspace in chat mode (3-column layout)      |
| `/knowledge-bases`            | KB management grid                            |

### Key Pattern: Monolithic Workspace

`components/workspace-page.tsx` is the core component — a 3-column layout that switches between knowledge and chat modes based on URL. The mode is detected via `getWorkspaceMode(pathname)` from `lib/paths.ts`.

### State Management

Two Zustand stores split by domain:

- `stores/knowledge-store.ts` — `knowledgeBases`, `documents`, `expandedDocId` + CRUD actions. Exports `buildKnowledgeBase()` factory.
- `stores/chat-store.ts` — `conversations`, `messagesByConversation` + CRUD actions.
- Custom hooks: `useKnowledgeBases()`, `useDocumentsByKb(kbId)`, `useConversationsByKb(kbId)`, `useConversationMessages(id)`

### Type System

All domain types defined in `types/index.ts`: User, KnowledgeBase, KnowledgeDocument, Citation, Message, Conversation.

## Code Style

- Prettier: single quotes, trailing commas (all), 120 char width, 2 spaces, semicolons
- All components are `'use client'` — no server components beyond layout
- Unused vars: prefix with `_` to suppress warnings
- ESLint flat config with typescript-eslint + react-hooks recommended rules
