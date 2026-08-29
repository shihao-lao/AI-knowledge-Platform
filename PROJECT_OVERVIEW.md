# 项目全局概览 📊

## 📋 项目基本信息

- **项目名称**: AI 面试知识库智能问答平台
- **项目类型**: 全栈 Web 应用
- **技术栈**: Next.js (前端) + Python FastAPI (后端)
- **当前状态**: ✅ 开发完成，准备部署

---

## 📁 项目结构

### 根目录文件

| 文件/目录 | 说明 | 状态 |
|-----------|------|------|
| `app/` | Next.js 前端页面 | ✅ 正常 |
| `background/` | Python 后端 | ✅ 正常 |
| `lib/` | 前端库代码 | ✅ 正常 |
| `docs/` | 项目文档 | ✅ 正常 |
| `prisma/` | Prisma 配置 | ⚠️ 可选 |
| `scripts/` | 脚本工具 | ✅ 正常 |
| `.env.local` | 前端环境变量 | ✅ 已配置 |
| `README.md` | 项目主文档 | ✅ 完整 |
| `PROJECT_STRUCTURE.md` | 项目结构说明 | ✅ 完整 |

### 统计数据

| 目录 | 文件数 | 说明 |
|------|--------|------|
| `app/` | 23 | Next.js 前端页面 |
| `background/` | 58,572 | Python 后端（含依赖） |
| `background/app/` | 119 | Python 应用代码 |
| `lib/` | 24 | 前端库代码 |
| `docs/` | 7 | 项目文档 |
| **总计** | **58,745** | 项目文件 |

---

## 🐍 Python 后端 (background/)

### 目录结构

```
background/
├── app/                      # 应用代码 (119 文件)
│   ├── api/routes/           # API 路由 (9 个路由文件)
│   │   ├── auth.py           # 认证路由
│   │   ├── chat.py           # 聊天路由
│   │   ├── conversation.py   # 对话路由
│   │   ├── document.py       # 文档路由
│   │   ├── health.py         # 健康检查路由
│   │   ├── knowledge.py      # 知识库路由
│   │   ├── practice.py       # 练习路由
│   │   ├── question.py       # 题库路由
│   │   └── resume.py         # 简历路由
│   │
│   ├── services/             # 业务服务 (8 个服务文件)
│   │   ├── auth_service.py   # 认证服务
│   │   ├── chat_service.py   # 聊天服务
│   │   ├── conversation_service.py  # 对话服务
│   │   ├── document_service.py      # 文档服务
│   │   ├── knowledge_service.py     # 知识库服务
│   │   ├── practice_service.py      # 练习服务
│   │   ├── question_service.py      # 题库服务
│   │   └── resume_service.py        # 简历服务
│   │
│   ├── models/               # 数据模型
│   │   ├── schemas.py        # Pydantic 模型
│   │   └── enums.py          # 枚举定义
│   │
│   ├── infrastructure/       # 基础设施
│   │   ├── database/         # 数据库配置
│   │   ├── llm/              # LLM 集成
│   │   ├── cache/            # 缓存
│   │   ├── vectordb/         # 向量数据库
│   │   └── trace/            # 链路追踪
│   │
│   ├── core/                 # 核心业务逻辑
│   │   ├── rag/              # RAG 系统
│   │   ├── agent/            # Agent 系统
│   │   └── memory/           # 记忆系统
│   │
│   ├── etl/                  # ETL 流水线
│   ├── middleware/           # 中间件
│   └── main.py               # FastAPI 入口
│
├── alembic/                  # 数据库迁移
├── scripts/                  # 脚本工具
├── tests/                    # 测试文件
│
├── requirements.txt          # 完整依赖
├── requirements-minimal.txt  # 轻量级依赖
├── pyproject.toml            # 项目配置
├── Dockerfile                # Docker 配置
├── docker-compose.yml        # Docker Compose 配置
└── .env                      # 环境变量
```

### API 端点 (32 个)

#### 健康检查
- `GET /api/health` - 健康检查
- `GET /api/health/ready` - 就绪检查

#### 认证 (4 个)
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/logout` - 用户登出
- `GET /api/auth/me` - 获取当前用户

#### 知识库 (6 个)
- `GET /api/knowledge` - 获取知识库列表
- `POST /api/knowledge` - 创建知识库
- `GET /api/knowledge/{id}` - 获取知识库详情
- `PUT /api/knowledge/{id}` - 更新知识库
- `DELETE /api/knowledge/{id}` - 删除知识库
- `POST /api/knowledge/search` - 搜索知识库

#### 文档 (4 个)
- `GET /api/document` - 获取文档列表
- `POST /api/document/upload` - 上传文档
- `GET /api/document/{id}` - 获取文档详情
- `DELETE /api/document/{id}` - 删除文档

#### 对话 (6 个)
- `GET /api/conversations` - 获取对话列表
- `POST /api/conversations` - 创建对话
- `GET /api/conversations/{id}` - 获取对话详情
- `DELETE /api/conversations/{id}` - 删除对话
- `GET /api/conversations/{id}/messages` - 获取对话消息
- `POST /api/conversations/{id}/messages` - 添加消息

#### 聊天 (1 个)
- `POST /api/chat` - RAG 聊天（SSE 流式）

#### 题库 (4 个)
- `GET /api/questions` - 获取题目列表
- `POST /api/questions/import` - 导入题目
- `GET /api/questions/{id}` - 获取题目详情
- `DELETE /api/questions/{id}` - 删除题目

#### 练习 (2 个)
- `POST /api/practice/evaluate` - 评估答案
- `GET /api/practice/stats` - 获取练习统计

#### 简历 (3 个)
- `POST /api/resumes/upload` - 上传简历
- `GET /api/resumes` - 获取简历列表
- `GET /api/resumes/{id}` - 获取简历详情

### 技术栈

| 类别 | 技术 | 说明 |
|------|------|------|
| 框架 | FastAPI | 高性能异步框架 |
| ORM | SQLAlchemy | 数据库 ORM |
| 数据库 | SQLite / PostgreSQL | 开发/生产 |
| 认证 | JWT + bcrypt | 安全认证 |
| 文档 | Swagger UI / ReDoc | API 文档 |

---

## ⚛️ Next.js 前端 (app/)

### 目录结构

```
app/
├── chat/                     # 对话页面
├── knowledge/                # 知识管理页面
├── knowledge-bases/          # 知识库管理页面
├── questions/                # 题库页面
├── statistics/               # 统计页面
├── login/                    # 登录页面
├── register/                 # 注册页面
├── layout.tsx                # 根布局
└── page.tsx                  # 首页
```

### 前端库 (lib/)

```
lib/
├── api-client.ts             # API 客户端（指向 Python 后端）
├── chat.ts                   # 聊天相关
├── constants.ts              # 常量定义
├── document.ts               # 文档相关
├── mimo-api.ts               # MiMo API
├── paths.ts                  # 路径定义
├── db/                       # 数据库相关
├── embedding/                # 嵌入模型
├── lancedb/                  # LanceDB 相关
├── parser/                   # 解析器
├── rag/                      # RAG 相关
├── search/                   # 搜索相关
├── services/                 # 服务层
└── shared/                   # 共享代码
```

### 技术栈

| 类别 | 技术 | 说明 |
|------|------|------|
| 框架 | Next.js 16 | App Router |
| UI | Ant Design 5 | 组件库 |
| 语言 | TypeScript | 类型安全 |
| 样式 | CSS Modules | 样式隔离 |

---

## 📚 项目文档 (docs/)

| 文档 | 大小 | 说明 |
|------|------|------|
| `README.md` | 2KB | 文档目录说明 |
| `PYTHON_BACKEND_REFACTOR_COMPLETE.md` | 7KB | Python 后端重构完成报告 |
| `REFACTOR_COMPLETE_SUMMARY.md` | 5KB | 重构完成总结 |
| `TESTING_COMPLETE_SUMMARY.md` | 9KB | 测试完成总结 |
| `DATABASE_TEST_SUMMARY.md` | 3KB | 数据库测试总结 |
| `PROJECT_STATUS_FINAL.md` | 7KB | 项目最终状态 |
| `DATABASE_ANALYSIS_SUMMARY.md` | 6KB | 数据库配置分析 |

---

## 🚀 启动方式

### 方案一：直接启动（推荐）

#### 启动后端
```bash
cd background
python -m venv venv
venv\Scripts\activate
pip install -r requirements-minimal.txt
cp .env.example .env
# 编辑 .env 文件
python scripts/create_tables_sqlite.py
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### 启动前端
```bash
# 新终端
npm install
npm run dev
```

#### 访问应用
- **前端**: http://localhost:3000
- **后端 API**: http://localhost:8000/docs

### 方案二：Docker 启动

```bash
cd background
docker-compose up -d --build
```

---

## 🔧 配置文件

### 前端配置

| 文件 | 说明 |
|------|------|
| `.env.local` | 前端环境变量 |
| `package.json` | Node.js 依赖 |
| `tsconfig.json` | TypeScript 配置 |
| `next.config.ts` | Next.js 配置 |

### 后端配置

| 文件 | 说明 |
|------|------|
| `background/.env` | 后端环境变量 |
| `background/requirements-minimal.txt` | 轻量级依赖 |
| `background/requirements.txt` | 完整依赖 |
| `background/pyproject.toml` | Python 项目配置 |
| `background/alembic.ini` | Alembic 配置 |

---

## 📊 Git 提交历史

```
eec84cc fix: 添加 aiosqlite 依赖和修复脚本
f7e2d63 fix: 修复 SECRET_KEY 配置问题
046866c refactor: 整理项目结构，移除 Next.js 后端
06d5f94 feat: 添加 pip 国内镜像源配置
c1c7eed refactor: 整理项目文件结构
39a1e2d feat: 添加 Docker 快速启动支持
626c94a docs: 添加快速启动指南
0aefe00 fix: 修复 Alembic 数据库 URL 配置问题
1d52200 test: 添加 API 路由测试和测试报告
99b92d6 docs: 添加数据库测试总结
b8f8b51 docs: 添加测试完成总结报告
a666925 test: 添加数据库配置测试和测试报告
47a372c fix: 修复前端与后端集成问题
52c99c4 test: 添加 Python 后端测试报告和测试脚本
72cf053 docs: 添加代码质量检查报告和检查脚本
212ae1f docs: 添加前端与后端集成测试报告
80383bb fix: 修复依赖和配置审计发现的关键问题
f187042 docs: 添加数据库配置分析总结
7df5796 docs: 添加项目最终状态报告
a6eefae docs: 添加问题修复报告
08b2310 fix(python-backend): 修复多个安全和性能问题
fc779e5 docs: 更新 README 添加 Python 后端支持
55f444c docs: 添加最终重构完成总结
f248329 docs: 添加 Python 后端重构完成报告
0666695 docs(python-backend): 添加使用指南
eb9e0ea docs(python-backend): 添加重构总结文档
e033a55 fix(python-backend): 修复数据库模型导入和测试脚本
d4d13a7 feat(python-backend): 完成 Next.js API 后端重构为 Python FastAPI
```

---

## 🎯 项目状态

### ✅ 已完成

- [x] Python 后端重构
- [x] API 端点实现 (32 个)
- [x] 数据库模型设计
- [x] 认证系统实现
- [x] 前端集成配置
- [x] 测试和验证
- [x] 文档编写
- [x] Docker 配置

### ⚠️ 可选

- [ ] Prisma 数据库迁移（已用 SQLAlchemy 替代）
- [ ] LanceDB 向量数据库（可选）
- [ ] Redis 缓存（可选）
- [ ] Milvus 向量数据库（可选）

---

## 🚀 快速启动

### 一键启动脚本

**Windows:**
```bash
cd background
start.bat
```

**Mac/Linux:**
```bash
cd background
chmod +x start.sh
./start.sh
```

### 手动启动

```bash
# 1. 进入后端目录
cd background

# 2. 创建虚拟环境
python -m venv venv

# 3. 激活虚拟环境
venv\Scripts\activate

# 4. 安装依赖
pip install -r requirements-minimal.txt

# 5. 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 6. 创建数据库表
python scripts/create_tables_sqlite.py

# 7. 启动应用
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

## 📈 项目统计

| 指标 | 数量 |
|------|------|
| 总文件数 | 58,745 |
| 后端文件 | 119 |
| 前端文件 | 23 |
| API 端点 | 32 |
| 数据模型 | 10 |
| 服务层 | 8 |
| 文档 | 7 |
| Git 提交 | 28 |

---

## 🎊 最终状态

**项目状态**: ✅ 开发完成，准备部署

**后端**: Python FastAPI ✅  
**前端**: Next.js ✅  
**数据库**: SQLite (开发) / PostgreSQL (生产) ✅  
**认证**: JWT + bcrypt ✅  
**文档**: 完整 ✅  
**测试**: 通过 ✅

---

**项目全局概览完成！🎉**