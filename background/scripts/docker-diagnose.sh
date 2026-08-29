#!/bin/bash
# Docker 诊断脚本

echo "=========================================="
echo "  Docker 启动诊断"
echo "=========================================="

# 检查 Docker 是否运行
echo ""
echo "1. 检查 Docker 状态..."
if docker info > /dev/null 2>&1; then
    echo "✅ Docker 正在运行"
else
    echo "❌ Docker 未运行"
    echo "请启动 Docker Desktop"
    exit 1
fi

# 检查 Docker Compose
echo ""
echo "2. 检查 Docker Compose..."
if docker-compose --version > /dev/null 2>&1; then
    echo "✅ Docker Compose 已安装"
    docker-compose --version
elif docker compose version > /dev/null 2>&1; then
    echo "✅ Docker Compose 已安装"
    docker compose version
else
    echo "❌ Docker Compose 未安装"
    exit 1
fi

# 检查容器状态
echo ""
echo "3. 检查容器状态..."
docker-compose ps 2>/dev/null || docker compose ps 2>/dev/null

# 检查镜像下载进度
echo ""
echo "4. 检查镜像下载进度..."
docker images | grep -E "(postgres|redis|milvus|minio|etcd)" | head -10

# 检查日志
echo ""
echo "5. 查看应用日志（最后 20 行）..."
docker-compose logs --tail=20 app 2>/dev/null || docker compose logs --tail=20 app 2>/dev/null

# 检查数据库日志
echo ""
echo "6. 查看数据库日志（最后 10 行）..."
docker-compose logs --tail=10 postgres 2>/dev/null || docker compose logs --tail=10 postgres 2>/dev/null

# 检查网络
echo ""
echo "7. 检查网络连接..."
docker network ls | grep enterprise-ai-agent 2>/dev/null || echo "未找到项目网络"

# 检查端口占用
echo ""
echo "8. 检查端口占用..."
echo "端口 8000 (应用):"
netstat -ano | grep :8000 2>/dev/null || lsof -i :8000 2>/dev/null || echo "端口未被占用"

echo "端口 5432 (PostgreSQL):"
netstat -ano | grep :5432 2>/dev/null || lsof -i :5432 2>/dev/null || echo "端口未被占用"

echo ""
echo "=========================================="
echo "诊断完成"
echo "=========================================="