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

## 用 Docker 启动（推荐）

一条命令拉起应用 + MySQL + Milvus（含 etcd / MinIO），本机不需要装 Python 环境：

```bash
cd background
docker compose up -d --build      # 首次构建镜像约 10 分钟（torch ~196MB）
docker compose logs -f app        # 看日志（迁移会在启动时自动执行）
docker compose ps                 # 确认 5 个服务都是 healthy
```

启动后：接口文档 http://localhost:8000/docs

| 服务   | 宿主机端口 | 说明                                          |
| ------ | ---------- | --------------------------------------------- |
| app    | 8000       | 后端，启动时自动 `alembic upgrade head`       |
| mysql  | **3308**   | 3306 被宿主机 MySQL 占用、3307 被其它项目占用 |
| milvus | 19530/9091 | 向量库                                        |
| minio  | 9000/9001  | Milvus 的对象存储依赖                         |
| etcd   | 不发布     | 仅容器间访问                                  |

前端仍在宿主机跑（`pnpm run dev`，端口 3001），浏览器通过 `localhost:8000` 访问容器里的后端。

常用操作：

```bash
docker compose down                                  # 停止（保留数据）
docker compose down -v                               # 停止并删除数据卷（清空数据库，慎用）
docker compose up -d --build                         # 代码改动后重建
docker compose exec app python -m pytest tests -q    # 在容器里跑测试
```

**首次检索会下载向量与精排模型**（约 300 MB），缓存在 `hf_cache` 卷里，之后重建容器不必再下。

### 怎么确认真的跑起来了

`docker compose ps` 只能说明进程活着、健康检查通过，**看不出应用能不能真用上这些依赖**。
要验证到这一层，跑内置的检查脚本：

```bash
docker compose exec app python scripts/verify_stack.py
```

它会从应用进程内部实际连一遍 MySQL / Milvus / MinIO / etcd，读一次业务数据行数，
列出 Milvus 集合与实体数，并检查模型缓存与模型配置，最后给出汇总结论。

> 该脚本已随镜像构建进去。如果容器是加脚本之前构建的，先
> `docker compose cp scripts/verify_stack.py app:/app/scripts/`，或直接重建镜像。

### 两个容易踩的坑

1. **`HF_HUB_DISABLE_XET=1` 不能去掉。** hf-mirror 不代理 HuggingFace 的 Xet 传输协议，
   不关掉会在下载 `bge-small-zh-v1.5` 时卡在 1 MB 不动，表现为「发消息一直转圈」。已在 compose 里设好。
2. **`NO_PROXY` 要包含 `mysql,milvus,etcd,minio`。** 容器读不到 Windows 注册表里的系统代理，
   但显式声明可避免以后有人在容器内配了代理时，把内部服务名也转发出去。

### 与宿主机部署的差异

- 容器内数据库主机名是 `mysql`（不是 `localhost`）。compose 已在 `environment` 里覆盖
  `DATABASE_URL` 与 `MILVUS_HOST`，`.env` 保持本机开发的写法即可。
- 上传文件通过 `./uploads:/app/uploads` 挂载，在宿主机 `background/uploads/` 可直接查看。
- 镜像默认**不装中文字体**，简历 PDF 会用 ReportLab 内置的 `STSong-Light`（CID 字体），中文能正常导出。
  想要 TTF 嵌入效果可在构建时加 `--build-arg INSTALL_CJK_FONT=true`（会从 Debian 源装 Noto CJK，国内可能较慢）。
- 容器以非 root 用户 `appuser`(uid 10001) 运行。

## 本机直接启动（不用 Docker）

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

## 知识库资源清理

升级代码后先用 `.venv/Scripts/python.exe -m alembic upgrade head` 更新数据库。
整库删除会在同一事务中保存外部资源清理任务，随后删除上传文件、已登记的各模型
向量集合及进程缓存。Milvus 或文件系统暂时不可用时，任务保存在
`resource_cleanup_tasks`，启动时及运行期间每 30 秒检查到期任务，失败按退避间隔重试。
多个 worker 用数据库行锁避免重复处理；已经清理的文件和集合不会重复报错。

向量集合登记从本次升级开始生效。升级前曾切换模型、且没有登记记录的旧集合，
无法从原有哈希集合名反推出知识库归属，需要单独盘点；当前模型集合仍会纳入清理。

## 聊天中断与重试

`/chat` 接受可选的 `request_id`（UUID）。前端为每次新提问生成标识，重试沿用该标识；
后端原位更新同一对用户/助手消息，已完成请求直接重放结果，正在生成时拒绝重复调用。
消息列表返回请求标识、生成状态、错误及重试问题，刷新页面后仍可查看中断回答并重试。
生成过程中首个片段及每秒检查点会保存，正常失败/断连保存最后收到的片段；进程崩溃时
保留最近检查点。`CHAT_GENERATION_TIMEOUT` 默认为 180 秒，租约多留 30 秒，过期可恢复。
升级时须先运行 Alembic 迁移；历史消息默认视为已完成，原有内容和引用保持兼容。
