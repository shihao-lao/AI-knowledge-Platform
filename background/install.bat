@echo off
echo ==========================================
echo   安装依赖（使用国内镜像源）
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
echo 2. 升级 pip...
python -m pip install --upgrade pip

echo.
echo 3. 配置国内镜像源...
if not exist %USERPROFILE%\pip (
    mkdir %USERPROFILE%\pip
)
echo [global] > %USERPROFILE%\pip\pip.ini
echo index-url = https://pypi.tuna.tsinghua.edu.cn/simple >> %USERPROFILE%\pip\pip.ini
echo trusted-host = pypi.tuna.tsinghua.edu.cn >> %USERPROFILE%\pip\pip.ini
echo timeout = 120 >> %USERPROFILE%\pip\pip.ini

echo.
echo 4. 安装依赖...
pip install -r requirements-minimal.txt

echo.
echo 5. 安装完成！
echo.
pause