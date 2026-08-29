#!/bin/bash
# Docker 快速启动脚本

set -e

echo "=========================================="
echo "  AI 面试知识库 - Docker 快速启动"
echo "=========================================="

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ 错误: Docker 未安装"
    echo "请先安装 Docker Desktop: https://www.docker.com/products/docker-desktop/"
    exit 1
fi

# 检查 Docker Compose 是否安装
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ 错误: Docker Compose 未安装"
    echo "请先安装 Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

# 检查 .env 文件
if [ ! -f .env ]; then
    echo "📝 创建 .env 文件..."
    cp .env.example .env
    
    # 生成随机 SECRET_KEY
    SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || openssl rand -hex 32)
    sed -i "s/SECRET_KEY=your-secret-key-change-in-production/SECRET_KEY=$SECRET_KEY/" .env
    
    echo "✅ .env 文件已创建"
    echo "⚠️  请编辑 .env 文件配置其他选项（如 OPENAI_API_KEY）"
fi

echo ""
echo "🚀 启动所有服务..."
echo "首次启动需要几分钟时间下载镜像..."
echo ""

# 启动所有服务
docker-compose up -d --build

echo ""
echo "⏳ 等待服务启动..."
sleep 10

# 检查服务状态
echo ""
echo "📊 服务状态:"
docker-compose ps

echo ""
echo "✅ 启动完成！"
echo ""
echo "📚 访问以下地址:"
echo "   - API 文档: http://localhost:8000/docs"
echo "   - ReDoc: http://localhost:8000/redoc"
echo "   - 健康检查: http://localhost:8000/api/health"
echo ""
echo "🔧 常用命令:"
echo "   - 查看日志: docker-compose logs -f app"
echo "   - 停止服务: docker-compose down"
echo "   - 重启应用: docker-compose restart app"
echo ""
echo "=========================================="