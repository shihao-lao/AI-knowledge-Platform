# 快速启动指南

## 🚀 快速开始

### 方案一：使用 SQLite（推荐本地开发）

SQLite 不需要安装额外的数据库服务器，适合本地开发和测试。

```bash
# 1. 进入 background 目录
cd background

# 2. 创建 SQLite 数据库表
python scripts/create_tables_sqlite.py

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，设置 SECRET_KEY
# 将 DATABASE_URL 改为 SQLite:
# DATABASE_URL=sqlite+aiosqlite:///./app.db

# 4. 启动应用
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 5. 访问 API 文档
# 打开浏览器访问 http://localhost:8000/docs
```

### 方案二：使用 PostgreSQL（推荐生产环境）

```bash
# 1. 安装 PostgreSQL（如果还没有安装）
# Windows: 下载安装 https://www.postgresql.org/download/windows/
# Mac: brew install postgresql
# Linux: sudo apt-get install postgresql

# 2. 创建数据库
# 打开 PostgreSQL 命令行或使用 pgAdmin
CREATE DATABASE agent_db;

# 3. 进入 background 目录
cd background

# 4. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，设置:
# SECRET_KEY=your-secret-key
# DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/agent_db

# 5. 测试数据库连接
python scripts/test_connection.py

# 6. 创建数据库表
python scripts/create_tables.py

# 7. 启动应用
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 8. 访问 API 文档
# 打开浏览器访问 http://localhost:8000/docs
```

### 方案三：使用 Docker（推荐生产部署）

```bash
# 1. 进入 background 目录
cd background

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，设置 SECRET_KEY

# 3. 启动所有服务
docker-compose up -d --build

# 4. 查看日志
docker-compose logs -f app

# 5. 访问 API 文档
# 打开浏览器访问 http://localhost:8000/docs
```

## 🔧 环境变量配置

### 必需的环境变量

```env
# 认证密钥（必须设置）
SECRET_KEY=your-secret-key-change-in-production

# 数据库 URL
# SQLite（本地开发）
DATABASE_URL=sqlite+aiosqlite:///./app.db

# PostgreSQL（生产环境）
# DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/agent_db
```

### 可选的环境变量

```env
# 应用配置
APP_NAME=enterprise-ai-agent
APP_ENV=development
DEBUG=true
API_PREFIX=/api
HOST=0.0.0.0
PORT=8000

# CORS 配置
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# 速率限制
RATE_LIMIT_PER_MINUTE=60
RATE_LIMIT_PER_HOUR=1000

# OpenAI 配置（可选）
OPENAI_API_KEY=sk-your-key
OPENAI_API_BASE=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini

# Redis 配置（可选）
REDIS_URL=redis://localhost:6379/0

# Milvus 配置（可选）
MILVUS_HOST=localhost
MILVUS_PORT=19530
MILVUS_USER=
MILVUS_PASSWORD=
MILVUS_COLLECTION_NAME=agent_knowledge

# 日志级别
LOG_LEVEL=INFO
```

## 📋 API 端点列表

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

## 🧪 测试 API

### 使用 curl 测试

```bash
# 1. 健康检查
curl http://localhost:8000/api/health

# 2. 用户注册
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"test","email":"test@example.com","password":"Test1234"}'

# 3. 用户登录
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234"}'

# 4. 获取知识库列表（需要先登录获取 token）
curl -X GET http://localhost:8000/api/knowledge \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 使用 Python 测试

```python
import requests

BASE_URL = "http://localhost:8000/api"

# 1. 用户注册
response = requests.post(f"{BASE_URL}/auth/register", json={
    "name": "test",
    "email": "test@example.com",
    "password": "Test1234"
})
print("注册响应:", response.json())

# 2. 用户登录
response = requests.post(f"{BASE_URL}/auth/login", json={
    "email": "test@example.com",
    "password": "Test1234"
})
print("登录响应:", response.json())

# 3. 获取令牌
token = response.json().get("access_token")

# 4. 获取知识库列表
headers = {"Authorization": f"Bearer {token}"}
response = requests.get(f"{BASE_URL}/knowledge", headers=headers)
print("知识库列表:", response.json())
```

## 🔍 故障排除

### 1. 数据库连接失败

**问题**: `Connection refused` 或 `could not connect to server`

**解决方案**:
```bash
# 检查 PostgreSQL 是否正在运行
# Windows: 检查服务管理器
# Mac/Linux: 
sudo systemctl status postgresql

# 或者使用 SQLite 替代
# 修改 .env 文件:
DATABASE_URL=sqlite+aiosqlite:///./app.db
```

### 2. 模块导入错误

**问题**: `ModuleNotFoundError: No module named 'xxx'`

**解决方案**:
```bash
# 安装依赖
pip install -r requirements.txt

# 或者使用 pip install 单独安装
pip install python-jose[cryptography] passlib[bcrypt] bcrypt
```

### 3. 端口被占用

**问题**: `Address already in use`

**解决方案**:
```bash
# 查看端口占用
# Windows:
netstat -ano | findstr :8000
# Mac/Linux:
lsof -i :8000

# 杀死进程
# Windows:
taskkill /PID <进程ID> /F
# Mac/Linux:
kill -9 <进程ID>

# 或者使用其他端口
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

### 4. CORS 错误

**问题**: `Access to fetch at 'http://localhost:8000' from origin 'http://localhost:3000' has been blocked`

**解决方案**:
```bash
# 修改 .env 文件，添加前端地址
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

### 5. JWT 令牌错误

**问题**: `Invalid token` 或 `Token has expired`

**解决方案**:
```bash
# 1. 确保 SECRET_KEY 已设置
SECRET_KEY=your-secret-key

# 2. 重新登录获取新令牌
# 3. 检查令牌是否过期（默认 15 分钟）
```

## 📚 更多资源

- **API 文档**: http://localhost:8000/docs
- **ReDoc 文档**: http://localhost:8000/redoc
- **项目文档**: 查看 README.md 和其他 .md 文件

## 🆘 获取帮助

如果遇到问题，请检查：

1. **日志输出**: 查看终端输出的错误信息
2. **API 文档**: 访问 http://localhost:8000/docs 查看接口说明
3. **环境变量**: 确保 .env 文件配置正确
4. **依赖版本**: 确保 Python 版本 >= 3.11

---

**快速启动完成！🎉**