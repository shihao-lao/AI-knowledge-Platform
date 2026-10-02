# AI 面试知识库 · 后端服务

FastAPI 业务与 AI 服务。前端（Next.js）只负责页面，所有业务逻辑、RAG 检索与
大模型调用都在这里。

> 架构、模块职责与长期约定以仓库根目录的 [AGENTS.md](../AGENTS.md) 为准，
> 本文只讲「怎么把它跑起来」。

## 技术栈

| 层     | 选型                                                                         |
| ------ | ---------------------------------------------------------------------------- |
| Web    | FastAPI + Uvicorn                                                            |
| 数据   | MySQL 8（运行时 aiomysql 异步，迁移走 PyMySQL 同步）+ SQLAlchemy 2 + Alembic |
| 向量   | Milvus（pymilvus）                                                           |
| 检索   | BM25 + 向量双路召回 → RRF 融合 → Cross-Encoder 精排                          |
| 大模型 | 任意 OpenAI 兼容服务（用户在页面上自行配置，服务端 `.env` 仅兜底）           |
| 认证   | JWT（HS256）+ bcrypt                                                         |

## 快速开始

```bash
cd background

# 1. 虚拟环境（必须是 .venv，不要用系统 Python）
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Mac/Linux

# 2. 安装依赖
python -m pip install -r requirements.txt

# 3. 配置环境变量
copy .env.example .env          # Windows（Mac/Linux 用 cp）
#   SECRET_KEY 必填，未配置或过短会拒绝启动：
#   python -c "import secrets; print(secrets.token_hex(32))"

# 4. 建库 + 建表（幂等）
python scripts/init_db.py

# 5. 启动
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Windows 上也可以直接双击 `start.bat`，它会依次完成上面 5 步。

- 接口文档：http://localhost:8000/docs
- 健康检查：http://localhost:8000/api/v1/health

## 常用命令

```bash
python -m uvicorn app.main:app --reload --port 8000   # 开发（热重载）
python -m uvicorn app.main:app --port 8000            # 生产
python scripts/init_db.py                             # 建库 + 建表（幂等）
python -m alembic upgrade head                        # 执行迁移
python -m alembic revision --autogenerate -m "描述"    # 生成迁移
python -m pytest tests                                # 跑测试（需 MySQL 测试库）
python scripts/api_smoke_test.py                      # 全接口冒烟（需服务已启动）
```

外部依赖没起来时不会中断服务，只会降级：

| 缺什么         | 表现                                    |
| -------------- | --------------------------------------- |
| Milvus 未启动  | 退化为纯关键词检索，标记 `keyword_only` |
| 精排模型不可用 | 退回 RRF 顺序                           |
| 未配置任何模型 | AI 相关接口返回可读提示，其余功能正常   |

## 关键配置

配置放在 `.env`（从 `.env.example` 复制）：

| 变量                              | 说明                                                                    |
| --------------------------------- | ----------------------------------------------------------------------- |
| `SECRET_KEY`                      | 必填，JWT 签名密钥；未配置、过短或仍是示例值会拒绝启动                  |
| `DATABASE_URL`                    | MySQL 连接串（`mysql+aiomysql://...`）                                  |
| `ALLOWED_ORIGINS`                 | CORS 白名单，前端默认 `http://localhost:3001`                           |
| `HF_ENDPOINT`                     | 模型下载源。国内建议 `https://hf-mirror.com`，否则向量/精排模型加载失败 |
| `EMBEDDING_MODEL`                 | 向量模型，决定向量维度；更换后需对新集合重新索引                        |
| `RERANK_ENABLED` / `RERANK_MODEL` | 是否启用精排及其模型                                                    |
| `OPENAI_*` / `MIMO_*`             | **服务端兜底**模型配置，用户也可在「设置 → 模型配置」页填自己的         |

## 常见问题

**`ModuleNotFoundError: No module named 'aiomysql'`**
用错解释器了。确认已激活 `.venv`，并统一用 `python -m ...` 而不是裸命令。
裸 `uvicorn`/`alembic` 按 PATH 解析，多虚拟环境共存时会静默选错。

**`format`/`git diff` 显示整文件改动**
换行符问题。仓库用 `.gitattributes` 强制 LF，若本地历史检出是 CRLF：

```bash
git rm --cached -r -q . && git reset --hard -q
```

**检索结果明显变差、日志里有 "向量索引不可用"**
Milvus 未启动或 embedding 模型没下载成功。检查 `MILVUS_HOST` 与 `HF_ENDPOINT`。

**连本地模型（Ollama 等）报 502**
系统代理（clash 等）会把 `127.0.0.1` 也转发出去。本项目已自动把回环地址加入
`NO_PROXY`，若仍失败请检查代理软件自身的绕过规则。

**数据库连不上**
确认 MySQL 8 已启动、`.env` 的 `DATABASE_URL` 正确，并已执行
`python scripts/init_db.py`。测试另需 `ai_knowledge_platform_test` 库。
