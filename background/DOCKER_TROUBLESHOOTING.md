# Docker 启动故障排除指南 🔧

## 🚨 常见问题及解决方案

### 问题 1: Docker 启动时间过长

**症状**: 执行 `docker-compose up -d --build` 后长时间没有响应

**原因**: 首次启动需要下载多个大型镜像

**镜像大小**:
- PostgreSQL: ~200MB
- Redis: ~100MB
- Milvus: ~500MB
- MinIO: ~200MB
- etcd: ~50MB
- 应用镜像: ~500MB (构建时)

**总下载量**: ~1.5GB

**解决方案**:

1. **检查网络连接**
   ```bash
   # 测试网络速度
   curl -o /dev/null http://speedtest.tele2.net/10MB.zip
   ```

2. **使用国内镜像源（推荐）**
   
   创建或编辑 Docker 配置文件：
   
   **Windows**: `C:\Users\你的用户名\.docker\daemon.json`
   **Mac/Linux**: `~/.docker/daemon.json`
   
   ```json
   {
     "registry-mirrors": [
       "https://docker.mirrors.ustc.edu.cn",
       "https://hub-mirror.c.163.com",
       "https://mirror.ccs.tencentyun.com"
     ]
   }
   ```
   
   重启 Docker Desktop 后重新启动

3. **分步下载镜像**
   ```bash
   # 单独下载每个镜像
   docker pull postgres:16-alpine
   docker pull redis:7-alpine
   docker pull milvusdb/milvus:v2.4.15
   docker pull minio/minio:latest
   docker pull bitnami/etcd:3.5.5
   ```

4. **查看下载进度**
   ```bash
   # 在另一个终端查看
   docker images
   ```

---

### 问题 2: 容器启动失败

**症状**: `docker-compose ps` 显示容器状态为 `Exit` 或 `Restarting`

**诊断步骤**:

1. **查看容器日志**
   ```bash
   # 查看所有服务日志
   docker-compose logs
   
   # 查看特定服务日志
   docker-compose logs app
   docker-compose logs postgres
   docker-compose logs redis
   docker-compose logs milvus
   ```

2. **检查容器状态**
   ```bash
   docker-compose ps
   ```

3. **查看容器详情**
   ```bash
   docker inspect <容器名>
   ```

**常见错误及解决**:

#### 错误: `database system is starting up`
**原因**: PostgreSQL 还在初始化
**解决**: 等待 30-60 秒后重试

#### 错误: `FATAL: password authentication failed`
**原因**: 数据库密码错误
**解决**: 检查 `.env` 文件中的数据库配置

#### 错误: `could not connect to server`
**原因**: 数据库未就绪
**解决**: 确保 `depends_on` 配置正确

---

### 问题 3: 端口被占用

**症状**: `Bind for 0.0.0.0:8000 failed: port is already allocated`

**诊断**:

```bash
# Windows
netstat -ano | findstr :8000
netstat -ano | findstr :5432
netstat -ano | findstr :6379

# Mac/Linux
lsof -i :8000
lsof -i :5432
lsof -i :6379
```

**解决方案**:

1. **停止占用端口的进程**
   ```bash
   # Windows
   taskkill /PID <进程ID> /F
   
   # Mac/Linux
   kill -9 <进程ID>
   ```

2. **修改端口映射**
   
   编辑 `docker-compose.yml`：
   ```yaml
   services:
     app:
       ports:
         - "8001:8000"  # 改为其他端口
     postgres:
       ports:
         - "5433:5432"  # 改为其他端口
   ```

---

### 问题 4: 权限问题

**症状**: `permission denied while trying to connect to the docker API`

**解决方案**:

1. **Windows**:
   - 以管理员身份运行 Docker Desktop
   - 或者将用户添加到 `docker-users` 组

2. **Mac/Linux**:
   ```bash
   # 将用户添加到 docker 组
   sudo usermod -aG docker $USER
   
   # 重新登录以使权限生效
   ```

3. **使用 sudo（不推荐）**
   ```bash
   sudo docker-compose up -d
   ```

---

### 问题 5: 内存不足

**症状**: 容器频繁重启或崩溃

**诊断**:
```bash
# 查看容器资源使用
docker stats

# 查看系统资源
docker system df
```

**解决方案**:

1. **增加 Docker 内存限制**
   - Docker Desktop → Settings → Resources → Memory
   - 建议至少 4GB

2. **优化容器资源**
   
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

3. **清理未使用的资源**
   ```bash
   # 清理未使用的镜像
   docker system prune -a
   
   # 清理未使用的卷
   docker volume prune
   ```

---

### 问题 6: 网络问题

**症状**: 容器之间无法通信

**诊断**:
```bash
# 查看网络
docker network ls

# 查看网络详情
docker network inspect <网络名>

# 测试容器间通信
docker exec app ping postgres
```

**解决方案**:

1. **重建网络**
   ```bash
   docker-compose down
   docker-compose up -d
   ```

2. **检查 DNS 解析**
   ```bash
   docker exec app nslookup postgres
   ```

---

## 🔍 诊断脚本

### 运行诊断脚本

**Windows**:
```bash
scripts\docker-diagnose.bat
```

**Mac/Linux**:
```bash
chmod +x scripts/docker-diagnose.sh
./scripts/docker-diagnose.sh
```

### 诊断内容

诊断脚本会检查：
1. ✅ Docker 是否运行
2. ✅ Docker Compose 是否安装
3. ✅ 容器状态
4. ✅ 镜像下载进度
5. ✅ 应用日志
6. ✅ 数据库日志
7. ✅ 网络连接
8. ✅ 端口占用

---

## 🚀 优化启动速度

### 1. 使用预构建镜像

```bash
# 使用官方镜像而不是构建
docker-compose pull
docker-compose up -d
```

### 2. 并行下载

Docker 默认并行下载镜像，确保网络稳定

### 3. 使用本地镜像

如果之前已经下载过镜像，Docker 会使用缓存

### 4. 优化 Dockerfile

```dockerfile
# 使用多阶段构建
FROM python:3.12-slim AS base
# ... 构建步骤
```

---

## 📊 启动时间参考

| 阶段 | 预计时间 | 说明 |
|------|----------|------|
| 首次下载镜像 | 10-30 分钟 | 取决于网络速度 |
| 构建应用镜像 | 3-5 分钟 | 首次构建 |
| 启动服务 | 1-2 分钟 | 等待服务就绪 |
| **总计（首次）** | **15-40 分钟** | 包含所有步骤 |
| **总计（再次）** | **1-2 分钟** | 使用缓存 |

---

## 🛠️ 手动启动步骤

如果自动启动失败，可以手动启动：

### 步骤 1: 启动数据库
```bash
docker-compose up -d postgres
# 等待 30 秒
```

### 步骤 2: 启动 Redis
```bash
docker-compose up -d redis
# 等待 10 秒
```

### 步骤 3: 启动 Milvus 依赖
```bash
docker-compose up -d etcd minio
# 等待 30 秒
```

### 步骤 4: 启动 Milvus
```bash
docker-compose up -d milvus
# 等待 60 秒
```

### 步骤 5: 启动应用
```bash
docker-compose up -d app
# 等待 30 秒
```

### 步骤 6: 验证启动
```bash
docker-compose ps
curl http://localhost:8000/api/health
```

---

## 📝 检查清单

启动前检查：
- [ ] Docker Desktop 正在运行
- [ ] 内存至少 4GB
- [ ] 磁盘空间充足（至少 5GB）
- [ ] 网络连接正常
- [ ] `.env` 文件已配置
- [ ] 端口 8000, 5432, 6379 未被占用

启动后检查：
- [ ] 所有容器状态为 `Up`
- [ ] 应用日志无错误
- [ ] 健康检查通过
- [ ] API 文档可访问

---

## 🆘 获取帮助

### 查看官方文档
- Docker: https://docs.docker.com/
- Docker Compose: https://docs.docker.com/compose/
- PostgreSQL: https://hub.docker.com/_/postgres

### 社区支持
- Docker 社区: https://forums.docker.com/
- Stack Overflow: https://stackoverflow.com/questions/tagged/docker

### 项目支持
- 查看项目文档: `README.md`
- 查看快速启动: `QUICK_START.md`
- 查看使用指南: `USAGE_GUIDE.md`

---

**故障排除指南创建时间**: 2024年  
**维护者**: 项目团队