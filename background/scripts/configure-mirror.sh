#!/bin/bash
echo "=========================================="
echo "  配置 pip 国内镜像源"
echo "=========================================="

echo ""
echo "1. 检查 pip 配置目录..."
if [ ! -d "$HOME/.pip" ]; then
    mkdir -p "$HOME/.pip"
    echo "创建目录: $HOME/.pip"
fi

echo ""
echo "2. 配置清华镜像源..."
cat > "$HOME/.pip/pip.conf" << EOF
[global]
index-url = https://pypi.tuna.tsinghua.edu.cn/simple
trusted-host = pypi.tuna.tsinghua.edu.cn
timeout = 120
EOF

echo ""
echo "3. 配置完成！"
echo ""
echo "配置文件位置: $HOME/.pip/pip.conf"
echo ""
echo "配置内容:"
cat "$HOME/.pip/pip.conf"
echo ""
echo "现在可以使用以下命令安装依赖:"
echo "  pip install -r requirements-minimal.txt"
echo ""