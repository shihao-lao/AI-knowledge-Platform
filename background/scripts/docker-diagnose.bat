@echo off
REM Docker 诊断脚本 (Windows)

echo ==========================================
echo   Docker 启动诊断
echo ==========================================

REM 检查 Docker 是否运行
echo.
echo 1. 检查 Docker 状态...
docker info >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker 未运行
    echo 请启动 Docker Desktop
    pause
    exit /b 1
) else (
    echo ✅ Docker 正在运行
)

REM 检查 Docker Compose
echo.
echo 2. 检查 Docker Compose...
docker-compose --version >nul 2>&1
if errorlevel 1 (
    docker compose version >nul 2>&1
    if errorlevel 1 (
        echo ❌ Docker Compose 未安装
        pause
        exit /b 1
    ) else (
        echo ✅ Docker Compose 已安装
        docker compose version
    )
) else (
    echo ✅ Docker Compose 已安装
    docker-compose --version
)

REM 检查容器状态
echo.
echo 3. 检查容器状态...
docker-compose ps 2>nul || docker compose ps 2>nul

REM 检查镜像下载进度
echo.
echo 4. 检查镜像下载进度...
docker images | findstr /i "postgres redis milvus minio etcd"

REM 检查日志
echo.
echo 5. 查看应用日志（最后 20 行）...
docker-compose logs --tail=20 app 2>nul || docker compose logs --tail=20 app 2>nul

REM 检查数据库日志
echo.
echo 6. 查看数据库日志（最后 10 行）...
docker-compose logs --tail=10 postgres 2>nul || docker compose logs --tail=10 postgres 2>nul

REM 检查网络
echo.
echo 7. 检查网络连接...
docker network list | findstr enterprise-ai-agent 2>nul || echo 未找到项目网络

REM 检查端口占用
echo.
echo 8. 检查端口占用...
echo 端口 8000 (应用):
netstat -ano | findstr :8000 || echo 端口未被占用

echo 端口 5432 (PostgreSQL):
netstat -ano | findstr :5432 || echo 端口未被占用

echo.
echo ==========================================
echo 诊断完成
echo ==========================================

pause