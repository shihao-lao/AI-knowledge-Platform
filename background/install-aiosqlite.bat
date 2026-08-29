@echo off
echo ==========================================
echo   安装 aiosqlite
echo ==========================================

echo.
echo 1. 激活虚拟环境...
call venv\Scripts\activate.bat

echo.
echo 2. 配置国内镜像源...
set PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple
set PIP_TRUSTED_HOST=pypi.tuna.tsinghua.edu.cn

echo.
echo 3. 安装 aiosqlite...
pip install aiosqlite

echo.
echo 4. 验证安装...
python -c "import aiosqlite; print('aiosqlite 安装成功!')"

echo.
echo 5. 安装完成！
echo.
echo 现在可以启动应用:
echo   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
echo.
pause