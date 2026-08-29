@echo off
REM Docker 快速启动脚本 (Windows)

echo ==========================================
echo   AI 面试知识库 - Docker 快速启动
echo ==========================================

REM 检查 Docker 是否安装
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: Docker 未安装
    echo 请先安装 Docker Desktop: https://www.docker.com/products/docker-desktop/
    pause
    exit /b 1
)

REM 检查 Docker Compose 是否安装
docker-compose --version >nul 2>&1
if errorlevel 1 (
    docker compose version >nul 2>&1
    if errorlevel 1 (
        echo ❌ 错误: Docker Compose 未安装
        echo 请先安装 Docker Compose: https://docs.docker.com/compose/install/
        pause
        exit /b 1
    )
)

REM 检查 .env 文件
if not exist .env (
    echo 📝 创建 .env 文件...
    copy .env.example .env
    
    echo ✅ .env 文件已创建
    echo ⚠️  请编辑 .env 文件配置 SECRET_KEY 和其他选项
    echo.
)

echo.
echo 🚀 启动所有服务...
echo 首次启动需要几分钟时间下载镜像...
echo.

REM 启动所有服务
docker-compose up -d --build

echo.
echo ⏳ 等待服务启动...
timeout /t 10 /nobreak >nul

REM 检查服务状态
echo.
echo 📊 服务状态:
docker-compose ps

echo.
echo ✅ 启动完成！
echo.
echo 📚 访问以下地址:
echo    - API 文档: http://localhost:8000/docs
echo    - ReDoc: http://localhost:8000/redoc
echo    - 健康检查: http://localhost:8000/api/health
echo.
echo 🔧 常用命令:
echo    - 查看日志: docker-compose logs -f app
echo    - 停止服务: docker-compose down
echo    - 重启应用: docker-compose restart app
echo.
echo ==========================================

pause