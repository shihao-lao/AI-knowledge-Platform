# Docker 快速启动指南 🐳

## 🎯 为什么选择 Docker？

- ✅ **无需手动安装** PostgreSQL、Redis、Milvus
- ✅ **一键启动** 所有服务
- ✅ **环境一致** 开发和生产环境相同
- ✅ **易于清理** 删除容器即可清理环境

## 📋 前置要求

### 1. 安装 Docker Desktop

**Windows:**
```bash
# 下载 Docker Desktop for Windows
# 访问: https://www.docker.com/products/docker-desktop/
# 下载并安装，重启电脑
```

**Mac:**
```bash
# 下载 Docker Desktop for Mac
# 访问: https://www.docker.com/products/docker-desktop/
# 或使用 Homebrew:
brew install --cask docker
```

**Linux (Ubuntu/Debian):**
```bash
# 安装 Docker
sudo apt-get update
sudo apt-get install docker.io docker-compose
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
# 重新登录以使组权限生效
```

### 2. 验证 Docker 安装

```bash
# 检查 Docker 版本
docker --version

# 检查 Docker Compose 版本
docker-compose --version

# 测试 Docker 是否正常工作
docker run hello-world
```

## 🚀 快速启动步骤

### 步骤 1: 进入项目目录

```bash
cd background
```

### 步骤 2: 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件（可选）
# 设置 SECRET_KEY（必须）
# 设置 OPENAI_API_KEY（如果需要）
```

**必需配置:**
```env
# 认证密钥（必须设置）
SECRET_KEY=your-secret-key-change-in-production
```

**可选配置:**
```env
# OpenAI API（如果需要使用 LLM）
OPENAI_API_KEY=sk-your-key
OPENAI_MODEL=gpt-4o-mini

# 其他配置...
```

### 步骤 3: 启动所有服务

```bash
# 构建并启动所有服务
docker-compose up -d --build

# 或者使用简化命令
docker compose up -d --build
```

**首次启动需要几分钟时间，因为需要下载镜像和构建应用。**

### 步骤 4: 查看服务状态

```bash
# 查看所有容器状态
docker-compose ps

# 查看应用日志
docker-compose logs -f app

# 查看所有服务日志
docker-compose logs -f
```

### 步骤 5: 访问应用

**API 文档:**
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

**健康检查:**
```bash
curl http://localhost:8000/api/health
```

**其他服务:**
- PostgreSQL: localhost:5432
- Redis: localhost:6379
- Milvus: localhost:19530
- MinIO Console: http://localhost:9001

## 🧪 测试 API

### 1. 健康检查

```bash
curl http://localhost:8000/api/health
```

### 2. 用户注册

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"test","email":"test@example.com","password":"Test1234"}'
```

### 3. 用户登录

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234"}'
```

### 4. 获取知识库列表（需要先登录获取 token）

```bash
# 假设登录返回的 token 是 YOUR_TOKEN
curl -X GET http://localhost:8000/api/knowledge \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🔧 常用命令

### 服务管理

```bash
# 启动所有服务
docker-compose up -d

# 停止所有服务
docker-compose down

# 重启所有服务
docker-compose restart

# 重启单个服务
docker-compose restart app

# 查看服务状态
docker-compose ps
```

### 日志查看

```bash
# 查看应用日志
docker-compose logs -f app

# 查看 PostgreSQL 日志
docker-compose logs -f postgres

# 查看所有服务日志
docker-compose logs -f

# 查看最近 100 行日志
docker-compose logs --tail=100 app
```

### 数据管理

```bash
# 进入 PostgreSQL 容器
docker-compose exec postgres psql -U postgres -d agent_db

# 备份数据库
docker-compose exec postgres pg_dump -U postgres agent_db > backup.sql

# 恢复数据库
docker-compose exec -T postgres psql -U postgres agent_db < backup.sql
```

### 清理环境

```bash
# 停止并删除所有容器
docker-compose down

# 停止并删除所有容器和数据卷（⚠️ 会删除所有数据）
docker-compose down -v

# 删除所有未使用的镜像
docker system prune -a
```

## 📊 服务架构

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Compose                       │
├─────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  │
│  │  App    │  │PostgreSQL│  │  Redis  │  │ Milvus  │  │
│  │ (8000)  │  │  (5432)  │  │ (6379)  │  │(19530)  │  │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  │
│       │            │            │            │        │
│       └────────────┴────────────┴────────────┘        │
│                      Network                           │
└─────────────────────────────────────────────────────────┘
```

## 🔍 故障排除

### 问题 1: 端口被占用

**错误:** `Bind for 0.0.0.0:8000 failed: port is already allocated`

**解决方案:**
```bash
# 查看端口占用
# Windows:
netstat -ano | findstr :8000
# Mac/Linux:
lsof -i :8000

# 停止占用端口的进程，或者修改 docker-compose.yml 使用其他端口
# 例如: 将 "8000:8000" 改为 "8001:8000"
```

### 问题 2: Docker 启动失败

**错误:** `Cannot connect to the Docker daemon`

**解决方案:**
```bash
# 确保 Docker Desktop 正在运行
# Windows: 检查系统托盘的 Docker 图标
# Mac: 检查菜单栏的 Docker 图标
# Linux: 
sudo systemctl start docker
```

### 问题 3: 数据库连接失败

**错误:** `could not connect to server: Connection refused`

**解决方案:**
```bash
# 检查 PostgreSQL 容器是否正在运行
docker-compose ps

# 查看 PostgreSQL 日志
docker-compose logs postgres

# 等待 PostgreSQL 启动完成（首次启动可能需要 30 秒）
docker-compose up -d
# 等待 30 秒后再尝试连接
```

### 问题 4: 应用启动失败

**错误:** `ModuleNotFoundError` 或其他导入错误

**解决方案:**
```bash
# 重新构建应用镜像
docker-compose build --no-cache app

# 重新启动所有服务
docker-compose up -d --build
```

### 问题 5: 数据丢失

**问题:** 重启后数据丢失

**解决方案:**
```bash
# 确保使用了数据卷（docker-compose.yml 中已配置）
# 数据卷会持久化数据，即使容器删除也不会丢失

# 查看数据卷
docker volume ls

# 如果需要备份数据
docker-compose exec postgres pg_dump -U postgres agent_db > backup.sql
```

## 📈 性能优化

### 1. 资源限制

在 `docker-compose.yml` 中添加资源限制：

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

### 2. 日志管理

```yaml
services:
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## 🔒 安全建议

### 1. 修改默认密码

```env
# .env 文件
SECRET_KEY=your-very-long-random-secret-key
POSTGRES_PASSWORD=your-strong-password
```

### 2. 限制网络访问

```yaml
# docker-compose.yml
services:
  app:
    networks:
      - internal
    ports:
      - "127.0.0.1:8000:8000"  # 只允许本地访问

networks:
  internal:
    driver: bridge
```

### 3. 定期备份

```bash
# 创建备份脚本
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker-compose exec postgres pg_dump -U postgres agent_db > backup_$DATE.sql
```

## 📚 更多资源

- **Docker 官方文档**: https://docs.docker.com/
- **Docker Compose 文档**: https://docs.docker.com/compose/
- **PostgreSQL Docker 镜像**: https://hub.docker.com/_/postgres
- **Redis Docker 镜像**: https://hub.docker.com/_/redis
- **Milvus Docker 镜像**: https://hub.docker.com/r/milvusdb/milvus

## 🎉 快速命令参考

```bash
# 启动所有服务
docker-compose up -d --build

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f app

# 停止所有服务
docker-compose down

# 重启应用
docker-compose restart app

# 进入应用容器
docker-compose exec app bash

# 进入数据库
docker-compose exec postgres psql -U postgres -d agent_db
```

---

**Docker 快速启动完成！🎉**