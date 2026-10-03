# AGENTS.md

## Project Overview

AI 面试知识库智能问答平台，采用 Next.js 前端与 Python FastAPI 业务后端分离的架构。

- 前端：Next.js 16（App Router）、React 19、TypeScript、Ant Design 5。
- 后端：`background/app/main.py` 创建 FastAPI 应用，由 Uvicorn 运行，默认端口 8000。
- 数据层：SQLAlchemy 异步会话与 Alembic 迁移；默认 MySQL 8（utf8mb4，异步驱动 aiomysql；迁移走同步的 pymysql），Milvus 用于向量检索。
- 检索：向量 + BM25 双路并发召回 → RRF 融合 → Cross-Encoder 精排；任一环节失败均降级而非中断（详见下文）。
- AI：Python 后端实现文档处理、RAG、LLM 调用、流式聊天和练习评估。
- Next.js 负责页面服务；业务 API 在 Python 后端实现。
- 模型下载：本机通常无法直连 `huggingface.co`，`.env` 必须配置 `HF_ENDPOINT=https://hf-mirror.com`，否则向量/精排模型加载失败并退化为关键词检索。

## Commands

前端**统一使用 pnpm**（CI 同样是 pnpm），锁文件只有 `pnpm-lock.yaml`，请勿用 npm/yarn 安装：

```bash
pnpm install              # 安装依赖（CI 用 --frozen-lockfile）
pnpm run dev              # 前端开发服务器（0.0.0.0:3001）
pnpm run build            # 前端生产构建
pnpm run start:standalone # 运行 standalone 构建
pnpm test                 # 回归脚本（checks/*.mjs）
pnpm run lint             # ESLint
pnpm run format           # Prettier（写入）
pnpm run format:check     # Prettier 检查（CI 执行）
```

后端解释器用 **`background/.venv`**（唯一的虚拟环境，不要再在根目录另建），以下命令在 `background/` 目录执行：

```bash
python -m venv .venv                                          # 首次创建
.venv/Scripts/python.exe -m pip install -r requirements.txt   # Windows
# source .venv/bin/activate && pip install -r requirements.txt  # POSIX

python scripts/init_db.py   # 建库 + 建表（幂等）
python -m alembic upgrade head   # 或使用迁移建表
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
python -m pytest tests      # 测试连 MySQL 测试库 ai_knowledge_platform_test
```

> 务必使用 `python -m uvicorn`，不要用裸 `uvicorn`：后者按 PATH 解析，
> 在多虚拟环境或 conda 共存时会静默选用错误解释器，报出难以定位的依赖错误。
>
> 同理务必确认用的是 `background/.venv` 里的解释器：系统 Python 会直接报
> `ModuleNotFoundError: No module named 'aiomysql'`。

### 用 Docker 跑后端（本机不装 Python 环境时的推荐方式）

```bash
cd background
docker compose up -d --build                       # 应用 + MySQL + Milvus(含 etcd/MinIO)
docker compose ps                                  # 5 个服务应全部 healthy
docker compose logs -f app                         # 迁移在启动时自动执行
docker compose exec app python -m pytest tests -q  # 在容器里跑测试
docker compose down                                # 停止（保留数据卷）
```

- 容器内 `DATABASE_URL` 指向 `mysql:3306`、`MILVUS_HOST=milvus`，由 compose 的
  `environment` 覆盖 `.env` 里的 localhost 写法；**不要为了容器去改 `.env`**。
- MySQL 映射在宿主机 **3308**（3306 被本机 MySQL 服务占用，3307 被其它项目占用）。
- **`HF_HUB_DISABLE_XET=1` 不可移除**：hf-mirror 不代理 Xet 协议，
  不关掉会导致下载向量模型时卡在 1MB 不动，表现为「发消息一直转圈」。
- 改完后端代码需 `docker compose up -d --build` 重建镜像才会生效。

### 换行符

仓库通过 `.gitattributes` 强制 `eol=lf`。Windows 上若本地 `core.autocrlf=true`，
历史检出可能是 CRLF，会让 `pnpm format:check` 在未改动的文件上失败。修正方式：

```bash
git rm --cached -r -q . && git reset --hard -q
```

## Architecture

### API 与认证

- `lib/api-client.ts` 封装普通 HTTP 请求，`lib/chat-api.ts` 处理聊天 SSE；默认地址均为 `http://localhost:8000/api/v1`。
- 前端通过 `NEXT_PUBLIC_API_URL` 覆盖 API 地址；后端前缀由 `background/app/config.py` 中的 `api_prefix` 配置。修改前缀时需同步前端地址。
- 前端公开配置参考根目录 `.env.example`；后端配置放在 `background/.env`。跨域来源由后端 `ALLOWED_ORIGINS` 配置。
- Python 路由集中在 `background/app/api/routes/`，涵盖 auth、knowledge、document、conversation、chat、question、practice、resume、ai、citation、settings 和 health；注册列表以 `background/app/main.py` 为准。
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
    core/rag/                    # BM25 索引（retriever）与 Cross-Encoder 精排（reranker）
    etl/                         # 文档解析、分块与处理流水线
    infrastructure/              # SQLAlchemy、Milvus、LLM
    models/                      # Pydantic schema 与枚举
    middleware/                  # 限流与错误处理
  alembic/                       # 数据库迁移
  tests/                         # Python 测试
```

- ORM 数据模型以 `background/app/infrastructure/database/models.py` 为准。
- 修改聊天逻辑时检查 `background/app/services/chat_service.py`；检索编排在
  `background/app/services/retrieval_service.py`，BM25 与精排组件在 `background/app/core/rag/`。
- 新增业务能力时，在 Python 后端添加路由和服务，再更新前端 API 客户端。

### 检索链路与降级

```
query → BM25 召回 ┐
                  ├→ RRF 融合(k=60) → 候选池 top_k×4 → Cross-Encoder 精排 → Top-5
       → 向量召回  ┘
```

两路用 `asyncio.gather` 并发（BM25 走线程池，向量那一路主要是 IO 等待）。
所有环节都只降级、不中断：

| 故障                           | 行为                                                        |
| ------------------------------ | ----------------------------------------------------------- |
| Milvus 不可达 / embedding 失败 | 退化为纯关键词检索，标记 `keyword_only`，下一请求重试建索引 |
| 精排失败                       | 退回 RRF 顺序（`RERANK_ENABLED=0` 可关闭精排）              |
| 单路召回失败                   | 仅使用另一路结果                                            |

配置项：`EMBEDDING_MODEL`、`RERANK_ENABLED`、`RERANK_MODEL`、`RERANK_DEVICE`、`HF_ENDPOINT`。
切换 `EMBEDDING_MODEL` 会改变向量维度，集合名含模型名因而天然隔离，但需要对新集合重新索引。

### 大模型配置（用户级）

每个用户可以在「设置 → 模型配置」（`/settings/model`）页接入任意 OpenAI 兼容服务，
配置存在 `user_llm_configs` 表，按 `user_id` 一份。

```
resolve_llm_config(user_id) → LLMConfig
    ├─ 用户配置齐全 → 用它（source=user）
    └─ 否则        → 服务端 .env（source=server），两者都没有则 source=none
```

- **所有 LLM 调用点都必须走 `app/infrastructure/llm/config.py`**，不要直接读
  `os.getenv("MIMO_*")`，否则用户自己配置的模型不会生效。涉及聊天
  (`chat_service`)、练习评分 (`llm/evaluation`)、简历分析
  (`llm/resume_analysis`)、简历结构化 (`llm/resume_structure`)、AI 摘要与
  Skill (`api/routes/ai.py`)。
- API Key 只保存在服务端，接口一律返回脱敏形式（`api_key_masked`）；前端提交时
  留空即表示沿用已保存的密钥。
- `api/routes/settings.py` 提供读取、保存、清除、连通性测试与模型列表拉取。
- 回环地址会自动追加进 `NO_PROXY`：系统代理（clash 等）通常无法访问
  `127.0.0.1` 并返回 502，不绕过会导致本地 Ollama 之类的模型完全不可用。

配置项：`OPENAI_*`、`MIMO_*`（服务端兜底）、`LLM_TEMPERATURE`、`LLM_MAX_TOKENS`、`LLM_TIMEOUT`。

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
