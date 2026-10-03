# AI 面试知识库智能问答平台

面向 AI 面试备考场景的检索增强生成（RAG）平台：把自己的知识库文档灌进去，
基于文档内容进行**可溯源的流式问答**，并配套模拟面试与结构化评分。
上传文档、导入面试题目，通过 AI 对话检索资料并生成**带引用标注**的回答。

前端只负责页面与交互，**全部业务与 AI 链路在 Python 后端**。

```
Next.js 16 (App Router) ──HTTP/SSE──> FastAPI ──┬── MySQL 8     用户 / 知识库 / 文档 / 对话 / 题库 / 简历
   React 19 · TS · antd 5                      ├── Milvus      向量检索
                                               ├── BM25        关键词检索（进程内）
                                               └── OpenAI 兼容 LLM（用户可自配）
```

## 核心特性

- **混合检索 + 精排**：向量与 BM25 双路并发召回 → RRF 融合 → Cross-Encoder 精排 → Top-5 注入 Prompt
- **可溯源引用**：系统 Prompt 强制模型输出 `[n]`，服务端反解为文档 ID / 切片序号 / 内容预览，前端渲染为可展开卡片
- **全链路降级**：Milvus、精排、模型任一环节不可用都只降级不中断（详见下文）
- **用户级模型配置**：每位用户可接入任意 OpenAI 兼容服务，密钥服务端存储、接口只回脱敏值
- **增量索引**：按内容 SHA-256 差分，仅重新向量化变更分片，upsert 幂等写入
- **多租户隔离**：集合名由 `SHA-256(知识库 ID + 模型名)` 派生，检索期再按有效 ID 二次收敛
- **流式对话**：SSE 增量渲染，滑动窗口保留最近 10 轮上下文
- **模拟面试与评分**：LLM 以 JSON Mode + `temperature=0` 输出，经 Pydantic 严格校验后才落库

## 技术栈

| 层         | 选型                                                                                               |
| ---------- | -------------------------------------------------------------------------------------------------- |
| 前端       | Next.js 16（App Router，Turbopack）· React 19 · TypeScript 5 · Ant Design 5 · zustand              |
| 后端       | Python 3.12 · FastAPI · Uvicorn · Pydantic v2                                                      |
| 数据       | MySQL 8（utf8mb4，运行时 `aiomysql` 异步 / 迁移走 `PyMySQL` 同步）· SQLAlchemy 2.0 async · Alembic |
| 向量       | Milvus · pymilvus                                                                                  |
| 检索与模型 | BM25（自实现）· RRF · Cross-Encoder 精排 · `BAAI/bge-small-zh-v1.5` 向量化 · tiktoken 分块         |
| 大模型     | 任意 OpenAI 兼容服务（用户自配）· LangChain（仅 Chain 编排）· SSE 流式                             |
| 工程       | pnpm · Docker Compose · GitHub Actions · ESLint · Prettier                                         |

## 检索链路

这是本项目的核心。查询进来后走三段式链路：

```
       ┌─ BM25 关键词召回（进程内索引，中文 bigram）─┐
query ─┤                                            ├─ RRF 融合(k=60) ─→ 候选池 top_k×4 ─→ Cross-Encoder 精排 ─→ Top-5
       └─ Milvus 向量召回（IVF_FLAT / L2）──────────┘
```

- 两路用 `asyncio.gather` **并发**执行（BM25 走线程池，避免阻塞事件循环）
- **为什么用 RRF 而不是加权求和**：BM25 分值与 L2 距离量纲和方向都不可比，归一化要调参且不稳定；
  RRF 只依赖名次，天然免疫量纲问题
- **为什么还要精排**：BM25 是词频模型、双塔向量是粗排模型，都无法建模 query 与文档的细粒度交互；
  Cross-Encoder 把两者拼接后过一遍模型，精度更高但更慢，因此只对 top_k×4 的小候选池执行

关键参数（均可在 `.env` 调整）：RRF `k=60`、召回倍数 `4`、最终 `Top-5`、
分块 `512 token / 64 overlap`、BM25 `k1=1.5 b=0.75`、Milvus `nlist=128 / nprobe=10`。

### 全链路降级

设计原则：**检索与数据链路只降级、不中断**。

| 故障                          | 行为                                                            |
| ----------------------------- | --------------------------------------------------------------- |
| Milvus 不可达 / 向量化失败    | 退化为纯关键词检索，响应标记 `keyword_only`，下一请求重试建索引 |
| 精排模型不可用 / 推理异常     | 静默退回 RRF 顺序（`RERANK_ENABLED=0` 可整体关闭）              |
| 单路召回失败                  | 仅使用另一路结果                                                |
| 未配置任何大模型              | AI 接口返回可读提示，其余功能不受影响                           |
| LLM 返回非法 JSON（评分场景） | 拒绝落库并提示重试，不写入脏数据                                |

## 快速开始

### 前置依赖

MySQL 8 必需；Milvus 可选 —— 不启动也能用，检索会自动降级为关键词模式。

```bash
cd background
docker compose up -d          # 拉起 mysql / etcd / minio / milvus（可选）
```

### 后端

```bash
cd background
python -m venv .venv
.venv\Scripts\activate                       # Windows（Mac/Linux: source .venv/bin/activate）
python -m pip install -r requirements.txt
copy .env.example .env                       # Mac/Linux: cp
#   至少填 SECRET_KEY：python -c "import secrets; print(secrets.token_hex(32))"
python scripts/init_db.py                    # 建库 + 建表（幂等）
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Windows 也可直接双击 `background/start.bat`。接口文档：http://localhost:8000/docs

> **想省掉装环境的步骤？后端可以直接用 Docker 跑**（应用 + MySQL + Milvus 一条命令拉起）：
>
> ```bash
> cd background && docker compose up -d --build
> ```
>
> 详见 [background/README.md](./background/README.md#用-docker-启动推荐)。

### 前端

```bash
pnpm install
pnpm run dev                  # http://localhost:3001
```

首次进入后在 **设置 → 模型配置**（`/settings/model`）填入自己的 API Key 与模型即可开始对话。

### 测试

```bash
pnpm test                                      # 前端 5 个回归脚本
cd background && python -m pytest tests -q      # 后端 142 个用例（需 MySQL 测试库）
```

## 项目结构

```text
app/                              Next.js 页面（App Router）
components/                       前端共享组件
lib/                              API 客户端（api-client 走 REST / chat-api 走 SSE）
stores/  types/                   zustand 状态与领域类型
checks/                           前端回归脚本（node 直接跑，不依赖测试框架）
background/
  app/
    main.py                       FastAPI 入口与路由注册
    config.py                     配置（pydantic-settings）
    api/routes/                   HTTP 接口（12 个模块）
    services/                     业务：认证 / 知识库 / 文档 / 对话 / 聊天 / 题库 / 练习 / 简历
    core/rag/                     BM25 索引（retriever）与 Cross-Encoder 精排（reranker）
    etl/                          文档解析（TXT/MD/DOCX/PDF）· 递归分块 · 处理流水线
    infrastructure/               SQLAlchemy · Milvus · LLM 配置与调用
    models/                       Pydantic schema 与枚举
    middleware/                   限流与统一错误处理
  alembic/                        数据库迁移
  tests/                          pytest（142 用例）
  scripts/                        init_db / 冒烟 / 迁移工具
```

## 项目规模

| 指标   | 数值                                        |
| ------ | ------------------------------------------- |
| 后端   | 9,264 行 Python · 12 个路由模块 · 45 个接口 |
| 前端   | 6,503 行 TS/TSX                             |
| 数据表 | 10 张表 · 15 个索引                         |
| 测试   | 后端 142 个用例 · 前端 5 个回归脚本         |
| 提交   | 154 次                                      |

## 文档

| 文档                                           | 内容                                       |
| ---------------------------------------------- | ------------------------------------------ |
| [AGENTS.md](./AGENTS.md)                       | **架构与约定的唯一权威来源**，改代码前先读 |
| [CLAUDE.md](./CLAUDE.md)                       | Claude Code 使用约定                       |
| [background/README.md](./background/README.md) | 后端部署、配置项、常见问题排查             |
| [docs/README.md](./docs/README.md)             | 文档目录索引                               |

## 已知限制

诚实列出，避免误判项目边界：

- **没有检索评测集**：未跑过 Recall@K / MRR，"检索效果提升多少"无法量化回答
- **没有压测**：BM25 索引在进程内按知识库缓存，文档量级很大时首次构建会变慢，且未做后台索引队列
- **单机分层单体**：不是微服务；没有 Redis 等外部缓存
- **未接入 Agent**：LangChain 只用了 Prompt + LLM + Parser 的 Chain 编排，没有 Agent / 多智能体
- **Milvus 客户端待迁移**：`milvus_client.py` 仍用 ORM 风格的 `connections.connect`，
  该 API 在 pymilvus 3.1 被移除，因此依赖锁在 3.0.x
