# Python 后端使用指南

## 快速开始

### 1. 启动 Python 后端

```bash
# 进入 background 目录
cd background

# 安装依赖（如果还没有安装）
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置数据库连接等

# 运行数据库迁移（首次运行）
alembic upgrade head

# 启动 FastAPI 应用
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. 配置前端连接 Python 后端

在 Next.js 项目根目录创建 `.env.local` 文件：

```env
# 使用 Python 后端
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1

# 如果要切换回 Next.js API 路由，注释掉上面那行
# NEXT_PUBLIC_API_URL=
```

### 3. 访问 API 文档

启动 Python 后端后，可以访问以下地址查看 API 文档：

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

## API 端点说明

### 认证相关
- `POST /api/v1/auth/register` - 用户注册
- `POST /api/v1/auth/login` - 用户登录
- `POST /api/v1/auth/logout` - 用户登出
- `GET /api/v1/auth/me` - 获取当前用户信息

### 知识库管理
- `GET /api/v1/knowledge` - 获取知识库列表
- `POST /api/v1/knowledge` - 创建知识库
- `GET /api/v1/knowledge/{id}` - 获取知识库详情
- `PUT /api/v1/knowledge/{id}` - 更新知识库
- `DELETE /api/v1/knowledge/{id}` - 删除知识库
- `GET /api/v1/knowledge/search?q=关键词` - 搜索知识库

### 文档管理
- `GET /api/v1/documents?knowledgeId=xxx` - 获取文档列表
- `POST /api/v1/documents/upload?knowledgeId=xxx` - 上传文档
- `GET /api/v1/documents/{id}` - 获取文档详情
- `DELETE /api/v1/documents/{id}` - 删除文档

### 对话管理
- `GET /api/v1/conversations?knowledgeId=xxx` - 获取对话列表
- `POST /api/v1/conversations?knowledgeId=xxx` - 创建对话
- `GET /api/v1/conversations/{id}` - 获取对话详情
- `DELETE /api/v1/conversations/{id}` - 删除对话
- `GET /api/v1/conversations/{id}/messages` - 获取对话消息
- `POST /api/v1/conversations/{id}/messages` - 添加消息

### 聊天功能
- `POST /api/v1/chat` - RAG 聊天（SSE 流式响应）

请求体示例：
```json
{
  "conversationId": "对话ID",
  "question": "用户问题",
  "enableSearch": true,
  "mode": "question"
}
```

### 题库管理
- `GET /api/v1/questions?knowledgeId=xxx` - 获取题目列表
- `POST /api/v1/questions/import?knowledgeId=xxx` - 导入题目
- `GET /api/v1/questions/{id}` - 获取题目详情
- `DELETE /api/v1/questions/{id}` - 删除题目

### 练习功能
- `POST /api/v1/practice/evaluate` - 评估答案
- `GET /api/v1/practice/stats?knowledgeId=xxx` - 获取练习统计

### 简历功能
- `POST /api/v1/resumes/upload` - 上传简历
- `GET /api/v1/resumes` - 获取简历列表
- `GET /api/v1/resumes/{id}` - 获取简历详情

## 环境变量配置

### .env 文件配置示例

```env
# 应用配置
APP_NAME=enterprise-ai-agent
APP_ENV=development
DEBUG=true
API_PREFIX=/api/v1
HOST=0.0.0.0
PORT=8000

# 数据库配置
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/ai_knowledge

# Redis 配置
REDIS_URL=redis://localhost:6379/0

# Milvus 配置
MILVUS_HOST=localhost
MILVUS_PORT=19530
MILVUS_USER=
MILVUS_PASSWORD=
MILVUS_COLLECTION_NAME=agent_knowledge

# OpenAI 配置
OPENAI_API_KEY=your-api-key
OPENAI_API_BASE=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini

# JWT 配置
SECRET_KEY=your-secret-key-change-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=30

# 日志配置
LOG_LEVEL=INFO
```

## Docker 部署

### 1. 使用 Docker Compose

```bash
# 进入 background 目录
cd background

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 启动所有服务
docker-compose up -d --build

# 查看日志
docker-compose logs -f app
```

### 2. 单独构建 Docker 镜像

```bash
# 构建镜像
docker build -t ai-knowledge-backend .

# 运行容器
docker run -d \
  --name ai-knowledge-backend \
  -p 8000:8000 \
  -v $(pwd)/.env:/app/.env \
  ai-knowledge-backend
```

## 开发指南

### 1. 添加新的 API 端点

1. 在 `app/api/routes/` 目录下创建新的路由文件
2. 在 `app/services/` 目录下创建对应的服务文件
3. 在 `app/models/schemas.py` 中添加请求/响应模型
4. 在 `app/main.py` 中注册新路由

### 2. 数据库迁移

```bash
# 生成迁移脚本
alembic revision --autogenerate -m "描述信息"

# 执行迁移
alembic upgrade head

# 回滚迁移
alembic downgrade -1
```

### 3. 测试

```bash
# 运行单元测试
pytest

# 运行特定测试
pytest tests/test_auth.py

# 生成测试覆盖率报告
pytest --cov=app --cov-report=html
```

## 故障排除

### 1. 数据库连接失败

检查 `.env` 文件中的数据库配置：
```env
DATABASE_URL=postgresql+asyncpg://用户名:密码@主机:端口/数据库名
```

### 2. 依赖安装失败

```bash
# 使用国内镜像
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# 或者使用 conda
conda install -c conda-forge alembic python-jose passlib bcrypt
```

### 3. 端口被占用

```bash
# 查看端口占用
netstat -ano | findstr :8000

# 杀死进程
taskkill /PID <进程ID> /F
```

### 4. 前端无法连接后端

1. 确认 Python 后端已启动
2. 检查 `.env.local` 文件中的 `NEXT_PUBLIC_API_URL` 配置
3. 检查浏览器控制台是否有跨域错误
4. 确认 CORS 配置正确

## 性能优化

### 1. 数据库优化

- 添加数据库索引
- 使用连接池
- 优化查询语句

### 2. 缓存策略

- 使用 Redis 缓存热点数据
- 实现查询结果缓存
- 配置 HTTP 缓存头

### 3. 异步处理

- 使用异步数据库操作
- 实现异步任务队列
- 优化并发处理

## 监控和日志

### 1. 日志配置

```python
# 在 config.py 中配置日志级别
LOG_LEVEL=INFO  # DEBUG, INFO, WARNING, ERROR, CRITICAL
```

### 2. 性能监控

- 使用 FastAPI 的性能中间件
- 集成 APM 工具（如 Sentry）
- 监控数据库查询性能

### 3. 健康检查

访问 http://localhost:8000/api/v1/health 检查服务状态。

## 安全建议

1. **生产环境配置**：
   - 修改 `SECRET_KEY` 为强密码
   - 限制 CORS 来源
   - 使用 HTTPS

2. **数据库安全**：
   - 使用强密码
   - 限制数据库访问权限
   - 定期备份数据

3. **API 安全**：
   - 实现速率限制
   - 验证输入数据
   - 记录安全日志

## 常见问题

### Q: 如何切换回 Next.js API 路由？
A: 在 `.env.local` 文件中注释掉 `NEXT_PUBLIC_API_URL` 配置即可。

### Q: 如何添加新的数据库表？
A: 在 `app/infrastructure/database/models.py` 中添加新的模型类，然后运行数据库迁移。

### Q: 如何集成其他 LLM 服务？
A: 在 `app/infrastructure/llm/` 目录下添加新的 LLM 客户端实现。

### Q: 如何扩展 RAG 功能？
A: 在 `app/core/rag/` 目录下修改检索器、重排器和生成器。

## 更新日志

### v1.0.0 (2024-01-XX)
- 完成 Next.js API 后端重构为 Python FastAPI
- 实现所有核心 API 端点
- 添加 JWT 认证系统
- 集成 RAG 系统
- 支持 Docker 部署