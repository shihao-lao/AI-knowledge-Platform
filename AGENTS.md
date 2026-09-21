# AGENTS.md

## Project Overview

AI 面试知识库智能问答平台，采用 Next.js 前端与 Python FastAPI 业务后端分离的架构。

- 前端：Next.js 16（App Router）、React 19、TypeScript、Ant Design 5。
- 后端：`background/app/main.py` 创建 FastAPI 应用，由 Uvicorn 运行，默认端口 8000。
- 数据层：SQLAlchemy 异步会话与 Alembic 迁移；默认 PostgreSQL，Milvus 用于向量检索，Redis 用于缓存。
- AI：Python 后端实现文档处理、RAG、LLM 调用、流式聊天和练习评估。
- Next.js 负责页面服务；业务 API 在 Python 后端实现。

## Commands

前端命令在项目根目录执行，完整脚本见 `package.json`：

```bash
npm run dev               # 前端开发服务器
npm run build             # 前端生产构建
npm run start:standalone  # 运行 standalone 构建
npm run lint              # ESLint
npm run format            # Prettier（写入）
```

后端命令在 `background/` 目录执行：

```bash
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
python -m pytest tests    # 需安装 pyproject.toml 中的 dev 测试依赖；数据库测试需对应服务
```

## Architecture

### API 与认证

- `lib/api-client.ts` 封装普通 HTTP 请求，`lib/chat-api.ts` 处理聊天 SSE；默认地址均为 `http://localhost:8000/api/v1`。
- 前端通过 `NEXT_PUBLIC_API_URL` 覆盖 API 地址；后端前缀由 `background/app/config.py` 中的 `api_prefix` 配置。修改前缀时需同步前端地址。
- 前端公开配置参考根目录 `.env.example`；后端配置放在 `background/.env`。跨域来源由后端 `ALLOWED_ORIGINS` 配置。
- Python 路由集中在 `background/app/api/routes/`，涵盖 auth、knowledge、document、conversation、chat、question、practice、resume、ai 和 health；注册列表以 `background/app/main.py` 为准。
- 认证由 `background/app/services/auth_service.py` 实现，使用 bcrypt 密码哈希与 JWT；前端通过 `Authorization: Bearer` 发送令牌。
- 受保护接口在 Python 后端验证身份和资源归属；前端 `components/auth-guard.tsx` 负责页面访问引导。

### 目录与职责

```text
app/                             # Next.js 页面与布局
components/                      # 前端共享组件
lib/                             # API 客户端、前端 hooks 与展示辅助函数
stores/                          # 前端状态
types/                          # 前端领域类型
background/
  app/
    main.py                      # FastAPI 入口与路由注册
    config.py                    # 后端配置
    api/routes/                  # HTTP API
    services/                    # 认证、聊天、知识库、文档、题库、练习、简历业务
    core/                        # RAG、Agent、记忆、意图与工具
    etl/                         # 文档解析、分块与处理流水线
    infrastructure/              # SQLAlchemy、Milvus、Redis、LLM 与追踪
    models/                      # Pydantic schema 与枚举
    middleware/                  # 限流与错误处理
  alembic/                       # 数据库迁移
  tests/                         # Python 测试
```

- ORM 数据模型以 `background/app/infrastructure/database/models.py` 为准。
- 修改聊天逻辑时检查 `background/app/services/chat_service.py`；检索相关实现位于 `background/app/core/rag/`。
- 新增业务能力时，在 Python 后端添加路由和服务，再更新前端 API 客户端。

## 工作规范（长期约定）

- **小步提交**：每完成一个小的功能/修复就 `git commit` 一次，禁止攒一大批改动后一次性提交。
- **提交描述**：每条 commit 都要写清楚做了什么（type 用 `feat` / `fix` / `refactor` / `chore` / `docs` / `test`），正文用中文简述动机与关键点，必要时附要点列表。
- 示例：`feat(phase-d): 面试题库管理页（列表/筛选/JSON导入/删除）`

## Code Style

- Prettier：单引号、尾逗号、120 字符行宽、2 空格缩进、分号。
- 页面及交互组件使用 `'use client'`，布局可保留服务端组件。
- 未使用变量以 `_` 开头；TypeScript 路径别名 `@/*` 指向项目根目录。
- ESLint 使用 flat config；Python 格式与类型检查配置见 `background/pyproject.toml`。
- 后端密钥只放在服务端环境变量中，严禁使用 `NEXT_PUBLIC_` 前缀暴露密钥。
