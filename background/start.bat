@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ==========================================
echo   AI 面试知识库 - 后端启动
echo ==========================================

echo.
echo [1/5] 准备虚拟环境 .venv ...
if not exist ".venv\Scripts\activate.bat" (
    echo       未找到 .venv，正在创建 ...
    python -m venv .venv
    if errorlevel 1 (
        echo       创建失败：请确认已安装 Python 3.11+ 并加入 PATH
        pause
        exit /b 1
    )
)
call ".venv\Scripts\activate.bat"

echo.
echo [2/5] 安装依赖 ...
python -m pip install -q -r requirements.txt
if errorlevel 1 (
    echo       依赖安装失败
    pause
    exit /b 1
)

echo.
echo [3/5] 检查 .env ...
if not exist ".env" (
    copy ".env.example" ".env" >nul
    echo       已从 .env.example 生成 .env，请填写 SECRET_KEY 与模型 API Key
    echo       生成随机密钥：
    python -c "import secrets; print('SECRET_KEY=' + secrets.token_hex(32))"
    echo.
    pause
)

echo.
echo [4/5] 建库 + 建表 ...
python scripts/init_db.py
if errorlevel 1 (
    echo       初始化数据库失败：请确认 MySQL 8 已启动，且 .env 中 DATABASE_URL 正确
    pause
    exit /b 1
)

echo.
echo [5/5] 启动服务 ...
echo       应用地址: http://localhost:8000
echo       接口文档: http://localhost:8000/docs
echo       按 Ctrl+C 停止
echo.
echo 注意：这里用 python -m uvicorn 而不是裸 uvicorn。
echo       裸命令按 PATH 解析，多虚拟环境共存时会静默选错解释器。
echo.

python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

endlocal
pause
