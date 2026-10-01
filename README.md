# AI 面试知识库智能问答平台

基于 RAG（检索增强生成）的知识管理与面试备考系统。上传文档、导入面试题目，通过 AI 对话检索相关资料并生成**带引用标注**的回答；支持**模拟面试**（AI 面试官逐题问答）、**答题评估**（LLM 结构化评分）与**掌握度统计**。

前端 Next.js 只负责页面与交互，业务逻辑与 AI 链路全部在 Python FastAPI 后端。

---

## 核心能力

- **混合检索** — 向量检索（Milvus）+ Okapi BM25 关键词检索双路召回，RRF 融合，再做 Cross-Encoder 精排
- **可溯源引用** — 系统 Prompt 强制模型标注 `[n]`，服务端反解编号映射回原文，前端渲染为可展开的引用卡片，回答可核对
- **增量索引** — 以内容 SHA-256 差分，只重新向量化变更分片，写入 upsert 幂等
- **多租户隔离** — 每个知识库派生独立 Milvus 集合，检索期再用 ID 白名单二次收敛
- **容错降级** — 向量链路不可用时自动退化为纯关键词检索，精排失败退回 RRF 顺序，服务不中断
- **用户隔离** — JWT 鉴权，所有资源按 `Knowledge.user_id` 校验归属，跨用户访问一律 404
- **模拟面试与评估** — 双模式对话；作答由 LLM 以 JSON Mode + 低温度输出，经 Pydantic 严格校验后才落库

---

## 技术栈

| 层级       | 技术                                                                     |
| ---------- | ------------------------------------------------------------------------ |
| 前端       | Next.js 16 (App Router) · React 19 · TypeScript · Ant Design 5           |
| Web 框架   | FastAPI · Uvicorn                                                        |
| ORM / 迁移 | SQLAlchemy 2.0（async）· Alembic                                         |
| 数据层     | MySQL 8（`aiomysql` 运行时 / `pymysql` 迁移）· Milvus（向量库）          |
| 检索       | 自研 BM25（中文 bigram）· RRF 融合 · sentence-transformers Cross-Encoder |
| 向量模型   | `BAAI/bge-small-zh-v1.5`（可切换，本地推理）                             |
| LLM 编排   | LangChain（`ChatPromptTemplate \| ChatOpenAI \| StrOutputParser`）· SSE  |
| 模型       | 小米 MiMo（OpenAI 兼容协议）                                             |
| 认证       | JWT（HS256）+ bcrypt                                                     |
| 部署       | Docker Compose（app + mysql + etcd + minio + milvus）                    |

---

## 架构

```
┌───────────────────────────────────────────────────────────────┐
│  浏览器  Next.js 16 / React 19 / Ant Design 5                  │
│  ├─ /knowledge/:kbId            知识库工作区（上传 / 切片预览） │
│  ├─ /chat/:kbId/:conversationId 对话（知识问答 / 模拟面试）     │
│  ├─ /questions/:kbId            题库（筛选 / JSON 导入）        │
│  └─ /statistics/:kbId           引用统计 + 掌握度               │
│  lib/chat-api.ts  手写 SSE 解析（分帧 / 半包 UTF-8 / 断流检测） │
└──────────────────────────┬────────────────────────────────────┘
                           │ HTTP + Bearer JWT
┌──────────────────────────▼────────────────────────────────────┐
│  Python FastAPI  :8000   /api/v1   40 个端点 / 11 个路由模块    │
│                                                                │
│  中间件    RateLimit(60/min,1000/h) → ErrorHandler → CORS      │
│  路由层    auth knowledge document conversation chat question   │
│            practice resume ai citation health                   │
│  服务层    业务编排 + 归属校验                                   │
│  检索层    retrieval_service：双路召回 → RRF → 精排             │
│  ETL 层    parser（txt/md/docx/pdf）→ chunker（tiktoken 递归）  │
│  基础设施  异步会话 / MilvusManager / LLM 客户端                 │
└──────┬────────────────────────┬─────────────────┬─────────────┘
       │                        │                 │
┌──────▼───────┐   ┌────────────▼──────┐   ┌──────▼──────────┐
│  MySQL 8     │   │  Milvus           │   │  小米 MiMo      │
│  权威数据源   │   │  每知识库一集合    │   │  OpenAI 兼容    │
│  9 表 15 索引 │   │  IVF_FLAT / L2    │   │  SSE 流式       │
└──────────────┘   └───────────────────┘   └─────────────────┘
```

### 检索链路

```
query
  │
  ├──► BM25 关键词召回 ─┐   两路 asyncio.gather 并发
  │    (中文 bigram,     │   BM25 走线程池，向量那一路是 IO 等待
  │     k1=1.5 b=0.75)   │
  │                      ├──► RRF 融合 (k=60) ──► 候选池 = top_k × 4
  └──► Milvus 向量召回 ──┘                              │
       (IVF_FLAT/L2,                                   ▼
        nprobe=10)                          Cross-Encoder 精排
                                                        │
                                                        ▼
                                                   Top-5 注入 Prompt
```

设计取舍：

- **为什么混合检索**：纯向量对专有术语（"TCP 三次握手"）会把泛化内容排在前面，纯 BM25 存在词汇鸿沟（"页面渲染更快" vs "首屏性能优化"）。两者互补，BM25 保精确率、向量保召回率。
- **为什么用 RRF 而非加权求和**：BM25 分值无上界，L2 距离越小越好，量纲与方向都不可比；RRF 只用名次，免去归一化与调参。
- **为什么多召回再精排**：双塔与词频模型都是粗排，query 与文档各自独立编码；Cross-Encoder 把两者拼接后一起过模型，能建模细粒度交互，但每个候选都要一次推理，所以「多召回、少精排」。

### 降级策略

| 故障                           | 行为                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------- |
| Milvus 不可达 / embedding 失败 | 退化为纯关键词检索，标记 `index_status=keyword_only`，下一请求自动重试建索引 |
| 精排模型加载或推理失败         | 退回 RRF 排序，不影响检索结果返回                                            |
| 某一路召回失败                 | 仅使用另一路结果                                                             |
| LLM 评分返回非法结构           | 抛错并**不落库**，避免脏数据污染掌握度统计                                   |
| 简历分析 LLM 失败              | 回退本地启发式规则，功能仍可用                                               |

---

## 快速开始

### 环境要求

- Python ≥ 3.11、Node.js ≥ 18
- MySQL 8（必需）与 Milvus（可选；缺失时自动降级为关键词检索）

### 1. 后端

```bash
cd background

# 依赖（推荐使用项目自带的虚拟环境）
./venv/Scripts/python.exe -m pip install -r requirements.txt   # Windows
# source venv/bin/activate && pip install -r requirements.txt  # macOS / Linux

# 配置
cp .env.example .env
# 必填：SECRET_KEY（≥32 字节）、MIMO_API_KEY、DATABASE_URL
# 国内网络务必设置 HF_ENDPOINT=https://hf-mirror.com，否则模型无法下载

# 建表（二选一）
./venv/Scripts/python.exe scripts/init_db.py    # 建库 + 建表，幂等
./venv/Scripts/python.exe -m alembic upgrade head

# 启动
./venv/Scripts/python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

> **务必用 `python -m uvicorn` 而不是裸 `uvicorn`**：后者按 PATH 解析，
> 在多虚拟环境 / conda 共存时会静默使用错误的解释器，报出难以定位的依赖错误。

### 2. 前端

```bash
npm install
# 根目录 .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1" > .env.local
npm run dev        # http://localhost:3001
```

### 3. 可选：Docker Compose 一键起依赖

```bash
cd background
docker compose up -d          # app + mysql + etcd + minio + milvus
```

### 无 MySQL 时的开发回退

`.env` 中把数据库切为 SQLite 即可脱离 MySQL 运行（建表同上，`scripts/init_db.py` 会自动跳过建库步骤）：

```env
DATABASE_URL=sqlite+aiosqlite:///./dev.db
```

向量能力仍需要 Milvus；没有 Milvus 时检索自动走关键词模式。

### 中文模型下载

本机若无法直连 `huggingface.co`，必须在 `.env` 配置镜像，否则首次检索会因模型下载失败而退化：

```env
HF_ENDPOINT=https://hf-mirror.com
```

首次检索会自动下载向量模型（约 95MB）与精排模型（约 470MB）。

---

## 项目结构

```
├── app/                      Next.js 页面（App Router）
├── components/               前端共享组件
├── lib/                      API 客户端与 SSE 解析
├── checks/                   前端回归脚本（node --test）
└── background/               Python 后端
    ├── app/
    │   ├── main.py           FastAPI 入口与路由注册
    │   ├── config.py         pydantic-settings 配置
    │   ├── api/routes/       HTTP 路由（11 个模块）
    │   ├── services/         业务服务（12 个）
    │   ├── core/rag/         BM25 索引、Cross-Encoder 精排
    │   ├── etl/              文档解析与分块流水线
    │   ├── infrastructure/   SQLAlchemy 会话、Milvus、LLM 客户端
    │   ├── middleware/       限流与错误处理
    │   └── models/           Pydantic Schema 与枚举
    ├── alembic/              数据库迁移
    ├── scripts/              初始化与迁移脚本
    └── tests/                pytest 测试
```

---

## 常用命令

| 命令                                                  | 说明                                            |
| ----------------------------------------------------- | ----------------------------------------------- |
| `python -m uvicorn app.main:app --reload`             | 启动后端（在 `background/` 下）                 |
| `python scripts/init_db.py`                           | 建库 + 建表（幂等）                             |
| `python -m alembic upgrade head`                      | 执行迁移                                        |
| `python -m alembic revision --autogenerate -m "描述"` | 生成迁移                                        |
| `python -m pytest tests`                              | 后端测试（需 MySQL 测试库）                     |
| `python scripts/migrate_to_mysql.py`                  | 从 SQLite 迁移到 MySQL（先验证连通再改写 .env） |
| `npm run dev`                                         | 前端开发服务器                                  |
| `npm run lint` / `npm run format`                     | ESLint / Prettier                               |
| `npm test`                                            | 前端回归脚本                                    |

---

## 测试

- **后端**：pytest，覆盖鉴权与密钥校验、数据库配置与模型、文档解析各格式与异常路径、索引、检索精排链路（生效 / 关闭 / 失败降级）、LLM 评分、简历往返。
- **前端**：`checks/*.mjs` 回归脚本，覆盖认证会话、上传流程、SSE 流解析、简历流程。
- **CI**：GitHub Actions 执行 `format:check` 与 `tsc --noEmit`。

> CI 目前**不执行测试**（pytest 依赖 MySQL 与 Milvus，需要 service container），这是已知缺口，见下节。

---

## 已知限制与后续计划

主动记录当前方案的边界，也是后续优化的优先级排序：

| 优先级 | 问题                           | 现状与改进方向                                                                                                                            |
| ------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **P0** | **缺少检索评测集**             | 所有检索参数（分块大小、Top-K、RRF 常数）都是经验取值，没有 Recall@K / MRR / NDCG 数据支撑。应先标注 query→相关分片，建立可回归的评测基线 |
| **P0** | **BM25 索引每次检索全量重建**  | 当前从 MySQL 拉取全部切片重建内存索引，复杂度 O(N)，是最大性能瓶颈。应改为常驻索引 + 增量更新，或引入 Elasticsearch                       |
| **P1** | **无重排前的召回上限约束**     | 候选池固定为 `top_k × 4`，大知识库下召回质量仍受粗排限制                                                                                  |
| **P1** | **父子分块缺失**               | 分块按长度递归切分，未按 Markdown 标题层级保留结构；小块检索命中后应向 LLM 返回其父块以保证上下文完整                                     |
| **P2** | **限流为单机内存**             | 多实例部署时阈值失效，应迁移到 Redis 滑动窗口/令牌桶                                                                                      |
| **P2** | **上下文仅滑动窗口**           | 超出窗口的历史被硬截断；`Conversation.summary` 字段已预留但未启用，应实现滚动摘要 + 结构化长期记忆                                        |
| **P2** | **检索结果无缓存**             | 相同查询重复执行 embedding 与检索；查询向量适合加 LRU 缓存                                                                                |
| **P3** | **embedding 与进程同生命周期** | CPU 推理受 GIL 限制且无法水平扩展，应拆为独立推理服务                                                                                     |
| **P3** | **CI 未跑测试**                | 需配置 MySQL/Milvus service container                                                                                                     |
| **P3** | **无 OCR**                     | 扫描件 PDF 会被拒绝，需接入 Tesseract 或 PaddleOCR                                                                                        |

---

## API 端点

完整定义见运行后的 `/docs`（Swagger UI）或 `/redoc`。主要分组：

| 分组     | 数量 | 说明                                          |
| -------- | ---- | --------------------------------------------- |
| 认证     | 4    | 注册 / 登录 / 登出 / 当前用户                 |
| 知识库   | 6    | 增删改查与搜索                                |
| 文档     | 5    | 上传（ETL + 索引）/ 列表 / 详情 / 启停 / 删除 |
| 对话     | 7    | 会话与消息管理                                |
| 聊天     | 1    | RAG 对话（SSE 流式）                          |
| 题库     | 4    | 列表 / 详情 / JSON 导入 / 删除                |
| 练习     | 2    | 答题评估 / 掌握度统计                         |
| 简历     | 7    | 上传解析 / 结构化 / 导出                      |
| AI       | 1    | 通用生成                                      |
| 引用统计 | 1    | 文档引用次数与置信度聚合                      |
| 健康检查 | 2    | 存活与就绪                                    |

---

## 许可

MIT
