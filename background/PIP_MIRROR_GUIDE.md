# pip 国内镜像源配置指南 🇨🇳

## 🚨 问题描述

直接使用 PyPI 官方源下载速度很慢（10-20 kB/s），甚至超时失败。

## ✅ 解决方案：配置国内镜像源

### 方案一：临时使用镜像源（推荐测试）

```bash
# 清华镜像源（推荐）
pip install -r requirements-minimal.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# 阿里云镜像源
pip install -r requirements-minimal.txt -i https://mirrors.aliyun.com/pypi/simple/

# 豆瓣镜像源
pip install -r requirements-minimal.txt -i https://pypi.douban.com/simple/
```

### 方案二：永久配置镜像源（推荐）

#### Windows

1. **创建 pip 配置文件**
   ```bash
   # 打开命令提示符（cmd）
   notepad %USERPROFILE%\pip\pip.ini
   ```

2. **添加以下内容**
   ```ini
   [global]
   index-url = https://pypi.tuna.tsinghua.edu.cn/simple
   trusted-host = pypi.tuna.tsinghua.edu.cn
   timeout = 120
   ```

3. **保存并关闭文件**

#### Mac/Linux

1. **创建 pip 配置文件**
   ```bash
   mkdir -p ~/.pip
   nano ~/.pip/pip.conf
   ```

2. **添加以下内容**
   ```ini
   [global]
   index-url = https://pypi.tuna.tsinghua.edu.cn/simple
   trusted-host = pypi.tuna.tsinghua.edu.cn
   timeout = 120
   ```

3. **保存并关闭文件**
   - 按 `Ctrl + X`
   - 按 `Y`
   - 按 `Enter`

### 方案三：使用配置脚本（最简单）

**Windows:**
```bash
# 运行配置脚本
scripts\configure-mirror.bat
```

**Mac/Linux:**
```bash
# 添加执行权限
chmod +x scripts/configure-mirror.sh

# 运行配置脚本
./scripts/configure-mirror.sh
```

## 📋 国内镜像源列表

| 镜像源 | 地址 | 速度 | 稳定性 |
|--------|------|------|--------|
| 清华大学 | https://pypi.tuna.tsinghua.edu.cn/simple | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 阿里云 | https://mirrors.aliyun.com/pypi/simple/ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 豆瓣 | https://pypi.douban.com/simple/ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 中科大 | https://pypi.mirrors.ustc.edu.cn/simple/ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 华为云 | https://repo.huaweicloud.com/repository/pypi/simple/ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

**推荐**: 清华大学镜像源（最稳定、最快）

## 🔧 验证配置

### 检查 pip 配置

```bash
# 查看当前配置
pip config list

# 查看全局配置
pip config list --global
```

### 测试下载速度

```bash
# 测试下载一个小包
pip install requests -i https://pypi.tuna.tsinghua.edu.cn/simple
```

## 🚀 安装依赖

### 安装轻量级依赖（推荐）

```bash
# 激活虚拟环境
venv\Scripts\activate  # Windows
source venv/bin/activate  # Mac/Linux

# 安装依赖
pip install -r requirements-minimal.txt
```

### 安装完整依赖

```bash
# 激活虚拟环境
venv\Scripts\activate  # Windows
source venv/bin/activate  # Mac/Linux

# 安装依赖（包含 PyTorch 等大型包，需要较长时间）
pip install -r requirements.txt
```

## ⏱️ 安装时间预估

| 依赖类型 | 镜像源速度 | 预计时间 |
|----------|------------|----------|
| 轻量级依赖 | 清华镜像 | 2-5 分钟 |
| 轻量级依赖 | 官方源 | 10-30 分钟 |
| 完整依赖 | 清华镜像 | 10-20 分钟 |
| 完整依赖 | 官方源 | 1-3 小时 |

## 🔍 故障排除

### 问题 1: 仍然超时

**解决方案**: 增加超时时间
```bash
pip install -r requirements-minimal.txt -i https://pypi.tuna.tsinghua.edu.cn/simple --timeout 300
```

### 问题 2: SSL 证书错误

**解决方案**: 信任镜像源
```bash
pip install -r requirements-minimal.txt -i https://pypi.tuna.tsinghua.edu.cn/simple --trusted-host pypi.tuna.tsinghua.edu.cn
```

### 问题 3: 权限错误

**解决方案**: 使用 `--user` 参数
```bash
pip install -r requirements-minimal.txt -i https://pypi.tuna.tsinghua.edu.cn/simple --user
```

### 问题 4: 虚拟环境未激活

**解决方案**: 确保虚拟环境已激活
```bash
# Windows
venv\Scripts\activate

# Mac/Linux
source venv/bin/activate

# 检查是否激活
pip --version
# 应该显示虚拟环境路径
```

## 📝 快速命令参考

```bash
# 1. 配置镜像源（永久）
# Windows
notepad %USERPROFILE%\pip\pip.ini
# 添加: [global] index-url = https://pypi.tuna.tsinghua.edu.cn/simple

# Mac/Linux
nano ~/.pip/pip.conf
# 添加: [global] index-url = https://pypi.tuna.tsinghua.edu.cn/simple

# 2. 升级 pip
python -m pip install --upgrade pip

# 3. 安装依赖
pip install -r requirements-minimal.txt

# 4. 验证安装
pip list
```

## 🎯 推荐配置

### 最佳配置（清华镜像）

```ini
[global]
index-url = https://pypi.tuna.tsinghua.edu.cn/simple
trusted-host = pypi.tuna.tsinghua.edu.cn
timeout = 120
```

### 备用配置（阿里云镜像）

```ini
[global]
index-url = https://mirrors.aliyun.com/pypi/simple/
trusted-host = mirrors.aliyun.com
timeout = 120
```

## 📊 速度对比

| 镜像源 | 下载速度 | 稳定性 | 推荐指数 |
|--------|----------|--------|----------|
| 清华大学 | 1-10 MB/s | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 阿里云 | 1-10 MB/s | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 豆瓣 | 500KB-5MB/s | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 中科大 | 500KB-5MB/s | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 官方源 | 10-50 KB/s | ⭐⭐⭐ | ⭐ |

## 🎉 配置完成

配置镜像源后，安装速度将提升 **10-100 倍**！

**预计安装时间**: 2-5 分钟（轻量级依赖）

---

**镜像源配置完成！🇨🇳**