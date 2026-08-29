@echo off
echo ==========================================
echo   AI 面试知识库 - 后端启动
echo ==========================================

echo.
echo 1. 激活虚拟环境...
if exist venv\Scripts\activate.bat (
    call venv\Scripts\activate.bat
) else (
    echo 创建虚拟环境...
    python -m venv venv
    call venv\Scripts\activate.bat
)

echo.
echo 2. 安装依赖...
pip install -r requirements-minimal.txt

echo.
echo 3. 检查 .env 文件...
if not exist .env (
    echo 创建 .env 文件...
    copy .env.example .env
    echo 请编辑 .env 文件设置 SECRET_KEY
    echo.
    echo 生成随机密钥:
    python -c "import secrets; print('SECRET_KEY=' + secrets.token_hex(32))"
    echo.
    pause
)

echo.
echo 4. 创建数据库表...
python scripts/create_tables_sqlite.py

echo.
echo 5. 启动应用...
echo 应用将在 http://localhost:8000 启动
echo API 文档: http://localhost:8000/docs
echo.
echo 按 Ctrl+C 停止应用
echo.

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

pause