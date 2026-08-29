@echo off
echo ==========================================
echo   配置 pip 国内镜像源
echo ==========================================

echo.
echo 1. 检查 pip 配置目录...
if not exist %USERPROFILE%\pip (
    mkdir %USERPROFILE%\pip
    echo 创建目录: %USERPROFILE%\pip
)

echo.
echo 2. 配置清华镜像源...
echo [global] > %USERPROFILE%\pip\pip.ini
echo index-url = https://pypi.tuna.tsinghua.edu.cn/simple >> %USERPROFILE%\pip\pip.ini
echo trusted-host = pypi.tuna.tsinghua.edu.cn >> %USERPROFILE%\pip\pip.ini
echo timeout = 120 >> %USERPROFILE%\pip\pip.ini

echo.
echo 3. 配置完成！
echo.
echo 配置文件位置: %USERPROFILE%\pip\pip.ini
echo.
echo 配置内容:
type %USERPROFILE%\pip\pip.ini
echo.
echo 现在可以使用以下命令安装依赖:
echo   pip install -r requirements-minimal.txt
echo.
pause