# AI 面试知识库 - Python 后端 🐍

## 📋 项目概述

这是 AI 面试知识库的 Python 后端服务，使用 FastAPI 框架构建。

## 🚀 快速开始

### 1. 进入后端目录

```bash
cd background
```

### 2. 创建虚拟环境

```bash
python -m venv venv
```

### 3. 激活虚拟环境

```bash
# Windows:
venv\Scripts\activate

# Mac/Linux:
source venv/bin/activate
```

### 4. 安装依赖

```bash
pip install -r requirements-minimal.txt
```

### 5. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
SECRET_KEY=your-secret-key
DATABASE_URL=sqlite+aiosqlite:///./app.db
```

### 6. 创建数据库表

```bash
python scripts/create_tables_sqlite.py
```

### 7. 启动应用

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 8. 访问应用

- **API 文档**: http://localhost:8000/docs
- **健康检查**: http://localhost:8000/api/health

## 📁 项目结构

```
background/
├── app/                      # 应用代码
│   ├── api/routes/           # API 路由
│   ├── services/             # 业务服务
│   ├── models/               # 数据模型
│   ├── infrastructure/       # 基础设施
│   ├── core/                 # 核心业务逻辑
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
├── alembic.ini               # Alembic 配置
├── Dockerfile                # Docker 配置
├── docker-compose.yml        # Docker Compose 配置
└── .env.example              # 环境变量示例
```

## 🔧 常用命令

### 启动应用

```bash
# 开发模式（自动重载）
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 生产模式
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 数据库操作

```bash
# 创建数据库表（SQLite）
python scripts/create_tables_sqlite.py

# 创建数据库表（PostgreSQL）
python scripts/create_tables.py

# 测试数据库连接
python scripts/test_connection.py
```

### 测试

```bash
# 运行所有测试
python -m pytest tests/

# 运行特定测试
python tests/test_api_routes_working.py
```

## 📚 API 端点

### 健康检查

- `GET /api/health` - 健康检查
- `GET /api/health/ready` - 就绪检查

### 认证

- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/logout` - 用户登出
- `GET /api/auth/me` - 获取当前用户

### 知识库

- `GET /api/knowledge` - 获取知识库列表
- `POST /api/knowledge` - 创建知识库
- `GET /api/knowledge/{id}` - 获取知识库详情
- `PUT /api/knowledge/{id}` - 更新知识库
- `DELETE /api/knowledge/{id}` - 删除知识库
- `POST /api/knowledge/search` - 搜索知识库

### 文档

- `GET /api/document` - 获取文档列表
- `POST /api/document/upload` - 上传文档
- `GET /api/document/{id}` - 获取文档详情
- `DELETE /api/document/{id}` - 删除文档

### 对话

- `GET /api/conversations` - 获取对话列表
- `POST /api/conversations` - 创建对话
- `GET /api/conversations/{id}` - 获取对话详情
- `DELETE /api/conversations/{id}` - 删除对话
- `GET /api/conversations/{id}/messages` - 获取对话消息
- `POST /api/conversations/{id}/messages` - 添加消息

### 聊天

- `POST /api/chat` - RAG 聊天（SSE 流式）

### 题库

- `GET /api/questions` - 获取题目列表
- `POST /api/questions/import` - 导入题目
- `GET /api/questions/{id}` - 获取题目详情
- `DELETE /api/questions/{id}` - 删除题目

### 练习

- `POST /api/practice/evaluate` - 评估答案
- `GET /api/practice/stats` - 获取练习统计

### 简历

- `POST /api/resumes/upload` - 上传简历
- `GET /api/resumes` - 获取简历列表
- `GET /api/resumes/{id}` - 获取简历详情

## 🔍 故障排除

### 问题 1: 模块导入错误

```bash
# 确保虚拟环境已激活
venv\Scripts\activate  # Windows
source venv/bin/activate  # Mac/Linux

# 重新安装依赖
pip install -r requirements-minimal.txt
```

### 问题 2: 端口被占用

```bash
# 使用其他端口
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

### 问题 3: 数据库错误

```bash
# 删除旧的数据库文件
rm app.db

# 重新创建数据库表
python scripts/create_tables_sqlite.py
```

### 问题 4: SECRET_KEY 未设置

```bash
# 生成随机密钥
python -c "import secrets; print(secrets.token_hex(32))"

# 添加到 .env 文件
echo SECRET_KEY=your-generated-key >> .env
```

## 📊 测试 API

### 使用 curl

```bash
# 健康检查
curl http://localhost:8000/api/health

# 用户注册
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"test","email":"test@example.com","password":"Test1234"}'

# 用户登录
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234"}'
```

### 使用 Python

```python
import requests

BASE_URL = "http://localhost:8000/api"

# 健康检查
response = requests.get(f"{BASE_URL}/health")
print(response.json())

# 用户注册
response = requests.post(f"{BASE_URL}/auth/register", json={
    "name": "test",
    "email": "test@example.com",
    "password": "Test1234"
})
print(response.json())
```

## 📚 更多文档

- **快速启动**: `START_WITHOUT_DOCKER.md`
- **使用指南**: `USAGE_GUIDE.md`
- **Docker 部署**: `DOCKER_QUICK_START.md`
- **故障排除**: `DOCKER_TROUBLESHOOTING.md`
- **API 文档**: http://localhost:8000/docs

## 🎯 技术栈

- **框架**: FastAPI
- **ORM**: SQLAlchemy
- **数据库**: SQLite (开发) / PostgreSQL (生产)
- **认证**: JWT + bcrypt
- **文档**: Swagger UI / ReDoc

## 📝 开发规范

- 使用 Python 3.11+
- 遵循 PEP 8 代码规范
- 使用类型注解
- 编写单元测试
- 提交前运行测试

## 🚀 部署

### 开发环境

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 生产环境

```bash
# 使用 Gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker

# 或者使用 Uvicorn
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Docker 部署

```bash
docker-compose up -d --build
```

---

**Python 后端启动完成！🎉**

## 快速开始

### 本地开发

1. Python 3.11+，创建虚拟环境并安装依赖：

```bash
cd project-python
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
pip install -e .
```

2. 复制环境变量并编辑（至少填写 `OPENAI_API_KEY` 等）：

```bash
cp .env.example .env
```

3. 启动 API（需本机或 Compose 中已启动 Postgres / Redis / Milvus 若你要联调全栈）：

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

4. 访问健康检查：<http://127.0.0.1:8000/api/v1/health>

### Docker Compose

在项目根目录准备 `.env`（可由 `.env.example` 复制），然后：

```bash
docker compose up -d --build
```

Compose 包含 **app、postgres、redis、milvus**，以及 Milvus 官方 Standalone 模式所需的 **etcd、minio**（向量与元数据存储依赖，非业务微服务）。应用默认映射 `8000` 端口。

首次启动 Milvus 可能需要数十秒就绪；若应用启动过快导致连不上 Milvus，可在生产环境中为 app 增加重试或 `depends_on` 健康检查策略。

## 目录结构说明

```
project-python/
├── app/
│   ├── main.py                 # FastAPI 入口
│   ├── config.py               # 配置（pydantic-settings）
│   ├── api/routes/             # 路由：chat、document、health
│   ├── core/                   # Agent、RAG、记忆、工具、意图
│   ├── infrastructure/         # LLM、向量库、缓存、DB、追踪
│   ├── etl/                    # 解析、分块、流水线
│   └── models/                 # schemas、enums
├── requirements.txt
├── pyproject.toml
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

## 许可证

MIT（可按团队需要修改）。
