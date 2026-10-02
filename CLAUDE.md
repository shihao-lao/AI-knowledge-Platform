# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **架构与目录说明以 [AGENTS.md](./AGENTS.md) 为准**，本文件只保留 Claude Code 特有的使用约定，避免多处描述同一件事造成文档漂移。

## Project Overview

AI 面试知识库智能问答平台。前端 Next.js 16（App Router）+ React 19 + TypeScript 只负责页面与交互；业务逻辑与 AI 链路全部在 `background/` 下的 Python FastAPI 后端。

数据层为 MySQL 8（`aiomysql` 异步驱动）+ Milvus（向量库）。检索采用**向量 + BM25 双路召回 → RRF 融合 → Cross-Encoder 精排**，LLM 使用小米 MiMo（OpenAI 兼容协议），回答经 SSE 流式推送并携带可溯源引用。

## Commands

前端**统一使用 pnpm**（CI 同样是 pnpm），锁文件只有 `pnpm-lock.yaml`，勿用 npm/yarn：

```bash
pnpm install             # 安装依赖（CI 用 --frozen-lockfile）
pnpm run dev             # 开发服务器（0.0.0.0:3001）
pnpm run build           # 生产构建
pnpm run start:standalone # 生产运行（output=standalone，不能用 next start）
pnpm test                # 前端回归脚本（checks/*.mjs，node --test）
pnpm run lint            # ESLint
pnpm run format          # Prettier 写入
pnpm run format:check    # Prettier 检查（CI 执行）
```

后端用 **`background/.venv`** 里的解释器（唯一虚拟环境），命令在 `background/` 执行：

```bash
python scripts/init_db.py                              # 建库 + 建表（幂等）
python -m alembic upgrade head                         # 执行迁移
python -m alembic revision --autogenerate -m "描述"     # 生成迁移
python -m pytest tests                                 # 测试（需 MySQL 测试库）
python -m uvicorn app.main:app --reload --port 8000    # 启动
```

> 务必使用 `python -m uvicorn` 而非裸 `uvicorn`。后者按 PATH 解析，在多虚拟环境
> 或 conda 共存时会静默选用错误解释器，表现为莫名的 `ModuleNotFoundError`。
>
> 同理务必用 `background/.venv` 的解释器：系统 Python 会直接报
> `ModuleNotFoundError: No module named 'aiomysql'`。

## Architecture

见 [AGENTS.md](./AGENTS.md)。要点：

- 前端不做业务逻辑，所有请求经 `lib/api-client.ts`（普通 HTTP）与 `lib/chat-api.ts`（SSE 手写解析）打到 FastAPI。
- 检索编排在 `background/app/services/retrieval_service.py`；BM25 与精排实现在 `background/app/core/rag/`。
- 数据库模型以 `background/app/infrastructure/database/models.py` 为准（10 张表）。
- 认证为 JWT（HS256）+ bcrypt；归属校验在服务层，所有资源经 `Knowledge.user_id` 验证。

## Code Style

- Prettier：单引号、尾逗号、120 字符行宽、2 空格缩进、分号
- 交互组件使用 `'use client'`，布局可保留服务端组件
- 未使用变量以 `_` 开头
- ESLint 使用 flat config
- 后端密钥只放在服务端环境变量中，严禁使用 `NEXT_PUBLIC_` 前缀暴露

## 工作规范（长期约定）

- **小步提交**：每完成一个小的功能/修复就 `git commit` 一次，禁止攒一大批改动后一次性提交。
- **提交描述**：每条 commit 都要写清楚做了什么（type 用 `feat` / `fix` / `refactor` / `chore` / `docs` / `test`），正文用中文简述动机与关键点，必要时附要点列表。
- 示例：`feat(phase-d): 面试题库管理页（列表/筛选/JSON导入/删除）`
