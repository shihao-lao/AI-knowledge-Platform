# 不使用 Docker 直接启动后端服务 🚀

## 📋 前置要求

- Python 3.11+
- pip (Python 包管理器)

## 🚀 快速启动步骤

### 步骤 1: 进入后端目录

```bash
cd background
```

### 步骤 2: 创建虚拟环境（推荐）

```bash
# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# Windows:
venv\Scripts\activate

# Mac/Linux:
source venv/bin/activate
```

### 步骤 3: 安装依赖

**方式一：安装轻量级依赖（推荐，速度快）**
```bash
pip install -r requirements-minimal.txt
```

**方式二：安装完整依赖（包含所有功能，但需要下载 PyTorch 等大型包）**
```bash
pip install -r requirements.txt
```

### 步骤 4: 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件
# Windows: 记事本 .env
# Mac/Linux: nano .env 或 vim .env
```

**必须配置：**
```env
# 认证密钥（必须设置）
SECRET_KEY=your-secret-key-change-in-production

# 数据库 URL（使用 SQLite）
DATABASE_URL=sqlite+aiosqlite:///./app.db

# 其他配置保持默认即可
```

### 步骤 5: 创建数据库表

```bash
# 使用 SQLite 创建数据库表
python scripts/create_tables_sqlite.py
```

### 步骤 6: 启动应用

```bash
# 启动 FastAPI 应用
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**或者使用简化命令：**
```bash
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 步骤 7: 访问应用

**API 文档：**
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

**健康检查：**
```bash
curl http://localhost:8000/api/health
```

## 📝 完整启动脚本

### Windows (start.bat)

创建 `start.bat` 文件：
```batch
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
```

### Mac/Linux (start.sh)

创建 `start.sh` 文件：
```bash
#!/bin/bash
echo "=========================================="
echo "  AI 面试知识库 - 后端启动"
echo "=========================================="

echo ""
echo "1. 激活虚拟环境..."
if [ -d "venv" ]; then
    source venv/bin/activate
else
    echo "创建虚拟环境..."
    python3 -m venv venv
    source venv/bin/activate
fi

echo ""
echo "2. 安装依赖..."
pip install -r requirements-minimal.txt

echo ""
echo "3. 检查 .env 文件..."
if [ ! -f ".env" ]; then
    echo "创建 .env 文件..."
    cp .env.example .env
    echo "请编辑 .env 文件设置 SECRET_KEY"
    read -p "按 Enter 继续..."
fi

echo ""
echo "4. 创建数据库表..."
python scripts/create_tables_sqlite.py

echo ""
echo "5. 启动应用..."
echo "应用将在 http://localhost:8000 启动"
echo "API 文档: http://localhost:8000/docs"
echo ""
echo "按 Ctrl+C 停止应用"
echo ""

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**添加执行权限：**
```bash
chmod +x start.sh
```

## 🧪 测试 API

### 使用 curl 测试

```bash
# 1. 健康检查
curl http://localhost:8000/api/health

# 2. 用户注册
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"test","email":"test@example.com","password":"Test1234"}'

# 3. 用户登录
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234"}'

# 4. 获取知识库列表（需要先登录获取 token）
curl -X GET http://localhost:8000/api/knowledge \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 使用 Python 测试

```python
import requests

BASE_URL = "http://localhost:8000/api"

# 1. 健康检查
response = requests.get(f"{BASE_URL}/health")
print("健康检查:", response.json())

# 2. 用户注册
response = requests.post(f"{BASE_URL}/auth/register", json={
    "name": "test",
    "email": "test@example.com",
    "password": "Test1234"
})
print("注册响应:", response.json())

# 3. 用户登录
response = requests.post(f"{BASE_URL}/auth/login", json={
    "email": "test@example.com",
    "password": "Test1234"
})
print("登录响应:", response.json())

# 4. 获取令牌
token = response.json().get("access_token")

# 5. 获取知识库列表
headers = {"Authorization": f"Bearer {token}"}
response = requests.get(f"{BASE_URL}/knowledge", headers=headers)
print("知识库列表:", response.json())
```

## 🔧 常用命令

```bash
# 启动应用（开发模式）
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 启动应用（生产模式）
uvicorn app.main:app --host 0.0.0.0 --port 8000

# 查看帮助
uvicorn --help

# 检查 Python 版本
python --version

# 检查 pip 版本
pip --version

# 查看已安装的包
pip list

# 更新 pip
pip install --upgrade pip
```

## 🔍 故障排除

### 问题 1: 模块导入错误

**错误**: `ModuleNotFoundError: No module named 'xxx'`

**解决方案**:
```bash
# 确保虚拟环境已激活
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# 重新安装依赖
pip install -r requirements-minimal.txt
```

### 问题 2: 端口被占用

**错误**: `Address already in use`

**解决方案**:
```bash
# 查看端口占用
# Windows:
netstat -ano | findstr :8000
# Mac/Linux:
lsof -i :8000

# 使用其他端口
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

### 问题 3: 数据库错误

**错误**: `database is locked` 或其他数据库错误

**解决方案**:
```bash
# 删除旧的数据库文件
rm app.db

# 重新创建数据库表
python scripts/create_tables_sqlite.py
```

### 问题 4: SECRET_KEY 未设置

**错误**: `ValueError: 必须设置 SECRET_KEY 环境变量`

**解决方案**:
```bash
# 编辑 .env 文件
# 添加以下行：
SECRET_KEY=your-secret-key-change-in-production

# 或者生成随机密钥
python -c "import secrets; print(secrets.token_hex(32))"
```

## 📊 启动时间对比

| 方式 | 启动时间 | 说明 |
|------|----------|------|
| Docker（首次） | 15-40 分钟 | 需要下载镜像和依赖 |
| Docker（再次） | 1-2 分钟 | 使用缓存 |
| **直接启动（首次）** | **3-5 分钟** | 安装依赖 |
| **直接启动（再次）** | **10-30 秒** | 使用虚拟环境 |

## 🎯 推荐配置

### 开发环境

```env
# .env 文件
SECRET_KEY=dev-secret-key
DATABASE_URL=sqlite+aiosqlite:///./app.db
APP_ENV=development
DEBUG=true
```

### 生产环境

```env
# .env 文件
SECRET_KEY=your-very-long-random-secret-key
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/agent_db
APP_ENV=production
DEBUG=false
```

## 📚 更多资源

- **快速启动指南**: `QUICK_START.md`
- **使用指南**: `USAGE_GUIDE.md`
- **API 文档**: http://localhost:8000/docs
- **故障排除**: `DOCKER_TROUBLESHOOTING.md`

## 🎉 快速命令参考

```bash
# 一键启动（Windows）
start.bat

# 一键启动（Mac/Linux）
./start.sh

# 手动启动
cd background
python -m venv venv
source venv/bin/activate  # 或 venv\Scripts\activate
pip install -r requirements-minimal.txt
cp .env.example .env
# 编辑 .env 文件
python scripts/create_tables_sqlite.py
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

**不使用 Docker 启动完成！🎉**