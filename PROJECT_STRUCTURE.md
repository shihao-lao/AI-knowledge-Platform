# 项目文件结构说明

## 📁 目录结构

```
AI-knowledge-Platform/
├── 📁 app/                          # Next.js 前端应用
│   ├── 📁 api/                      # Next.js API 路由（可选）
│   ├── 📁 chat/                     # 对话页面
│   ├── 📁 knowledge/                # 知识管理页面
│   ├── 📁 questions/                # 题库页面
│   ├── 📁 statistics/               # 统计页面
│   ├── 📁 knowledge-bases/          # 知识库管理页面
│   └── 📄 layout.tsx                # 根布局
│
├── 📁 background/                   # Python 后端（FastAPI）
│   ├── 📁 app/                      # 应用代码
│   │   ├── 📁 api/routes/           # API 路由
│   │   ├── 📁 services/             # 业务服务
│   │   ├── 📁 models/               # 数据模型
│   │   ├── 📁 infrastructure/       # 基础设施
│   │   ├── 📁 core/                 # 核心业务逻辑
│   │   ├── 📁 etl/                  # ETL 流水线
│   │   ├── 📁 middleware/           # 中间件
│   │   └── 📄 main.py               # FastAPI 入口
│   │
│   ├── 📁 alembic/                  # 数据库迁移
│   │   ├── 📁 versions/             # 迁移版本
│   │   ├── 📄 env.py                # Alembic 环境配置
│   │   └── 📄 script.py.mako        # 迁移脚本模板
│   │
│   ├── 📁 scripts/                  # 脚本工具
│   │   ├── 📄 create_tables.py      # 创建数据库表
│   │   ├── 📄 create_tables_sqlite.py # SQLite 创建表
│   │   ├── 📄 test_connection.py    # 测试数据库连接
│   │   ├── 📄 generate_migration.py # 生成迁移脚本
│   │   ├── 📄 docker-start.sh       # Docker 启动脚本（Linux/Mac）
│   │   └── 📄 docker-start.bat      # Docker 启动脚本（Windows）
│   │
│   ├── 📁 tests/                    # 测试文件
│   │   ├── 📄 test_api_routes_working.py # API 路由测试
│   │   ├── 📄 test_db_config.py     # 数据库配置测试
│   │   ├── 📄 test_schemas.py       # Pydantic 模型测试
│   │   ├── 📄 test_migration.py     # 迁移脚本测试
│   │   └── 📄 README.md             # 测试说明
│   │
│   ├── 📁 uploads/                  # 上传文件目录
│   │   └── 📁 resumes/              # 简历文件
│   │
│   ├── 📄 requirements.txt          # Python 依赖
│   ├── 📄 pyproject.toml            # 项目配置
│   ├── 📄 alembic.ini               # Alembic 配置
│   ├── 📄 Dockerfile                # Docker 配置
│   ├── 📄 docker-compose.yml        # Docker Compose 配置
│   ├── 📄 .env.example              # 环境变量示例
│   ├── 📄 QUICK_START.md            # 快速启动指南
│   ├── 📄 DOCKER_QUICK_START.md     # Docker 快速启动指南
│   ├── 📄 USAGE_GUIDE.md            # 使用指南
│   └── 📄 REFACTOR_SUMMARY.md       # 重构总结
│
├── 📁 docs/                         # 项目文档
│   ├── 📄 README.md                 # 文档目录说明
│   ├── 📄 PYTHON_BACKEND_REFACTOR_COMPLETE.md
│   ├── 📄 REFACTOR_COMPLETE_SUMMARY.md
│   ├── 📄 TESTING_COMPLETE_SUMMARY.md
│   ├── 📄 DATABASE_TEST_SUMMARY.md
│   ├── 📄 PROJECT_STATUS_FINAL.md
│   └── 📄 DATABASE_ANALYSIS_SUMMARY.md
│
├── 📁 lib/                          # 共享库
│   ├── 📁 server/                   # 服务端代码
│   ├── 📁 shared/                   # 共享代码
│   ├── 📁 db/                       # 数据库相关
│   ├── 📁 embedding/                # 嵌入模型
│   ├── 📁 lancedb/                  # LanceDB 相关
│   ├── 📁 services/                 # 服务层
│   └── 📄 api-client.ts             # API 客户端
│
├── 📁 prisma/                       # Prisma 数据库配置
│   ├── 📁 migrations/               # 数据库迁移
│   └── 📄 schema.prisma             # 数据库 schema
│
├── 📁 scripts/                      # 脚本工具
│   ├── 📄 reingest-vectors.ts       # 重建向量
│   ├── 📄 compare-embedding.ts      # 嵌入对比
│   └── 📄 test-pipeline.ts          # 管线测试
│
├── 📁 public/                       # 静态资源
├── 📁 stores/                       # 状态管理
├── 📁 tests/                        # 前端测试
├── 📁 types/                        # TypeScript 类型定义
│
├── 📄 .env                          # 环境变量（本地）
├── 📄 .env.example                  # 环境变量示例
├── 📄 .env.local                    # 本地环境变量
├── 📄 .gitignore                    # Git 忽略文件
├── 📄 CLAUDE.md                     # Claude Code 开发指南
├── 📄 README.md                     # 项目主文档
├── 📄 prd.md                        # 产品需求文档
├── 📄 package.json                  # Node.js 依赖
├── 📄 tsconfig.json                 # TypeScript 配置
├── 📄 next.config.ts                # Next.js 配置
├── 📄 proxy.ts                      # 代理配置
└── 📄 PROJECT_STRUCTURE.md          # 本文件
```

## 📊 文件统计

| 目录        | 文件数   | 说明                   |
| ----------- | -------- | ---------------------- |
| app/        | 50+      | Next.js 前端页面和 API |
| background/ | 100+     | Python 后端代码        |
| docs/       | 7        | 项目文档               |
| lib/        | 30+      | 共享库代码             |
| prisma/     | 10+      | 数据库配置             |
| scripts/    | 10+      | 脚本工具               |
| **总计**    | **200+** | 项目文件               |

## 🎯 核心文件说明

### 前端核心文件

1. **app/layout.tsx** - 根布局文件
2. **lib/api-client.ts** - API 客户端
3. **lib/server/rag/chat-service.ts** - RAG 聊天服务
4. **prisma/schema.prisma** - 数据库 schema

### 后端核心文件

1. **background/app/main.py** - FastAPI 入口
2. **background/app/api/routes/** - API 路由
3. **background/app/services/** - 业务服务
4. **background/app/infrastructure/database/models.py** - 数据库模型
5. **background/docker-compose.yml** - Docker 配置

### 配置文件

1. **.env** - 环境变量
2. **package.json** - Node.js 依赖
3. **background/requirements.txt** - Python 依赖
4. **background/pyproject.toml** - Python 项目配置

## 🚀 快速导航

### 新开发者入门

1. 阅读 [README.md](README.md) 了解项目概况
2. 阅读 [CLAUDE.md](CLAUDE.md) 了解开发规范
3. 查看 [background/QUICK_START.md](background/QUICK_START.md) 快速启动

### 后端开发

1. 进入 `background/` 目录
2. 查看 [background/USAGE_GUIDE.md](background/USAGE_GUIDE.md) 使用指南
3. 查看 [background/DOCKER_QUICK_START.md](background/DOCKER_QUICK_START.md) Docker 部署

### 前端开发

1. 进入项目根目录
2. 运行 `npm run dev` 启动开发服务器
3. 查看 `app/` 目录下的页面组件

### 数据库相关

1. **Prisma**: 查看 `prisma/schema.prisma`
2. **SQLAlchemy**: 查看 `background/app/infrastructure/database/models.py`
3. **迁移**: 查看 `background/alembic/` 和 `prisma/migrations/`

## 📝 文件命名规范

### 前端文件

- **页面**: `page.tsx` (Next.js App Router)
- **布局**: `layout.tsx`
- **组件**: `ComponentName.tsx`
- **工具**: `utility-name.ts`

### 后端文件

- **路由**: `resource_name.py`
- **服务**: `resource_service.py`
- **模型**: `models.py`
- **配置**: `config.py`

### 测试文件

- **单元测试**: `test_*.py`
- **集成测试**: `test_*_integration.py`
- **端到端测试**: `test_*_e2e.py`

## 🔧 常用命令

### 前端

```bash
# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 运行测试
npm test

# 代码格式化
npm run format
```

### 后端

```bash
# 进入后端目录
cd background

# 启动开发服务器
uvicorn app.main:app --reload

# 运行测试
python -m pytest tests/

# 数据库迁移
alembic upgrade head
```

### Docker

```bash
# 启动所有服务
docker-compose up -d --build

# 停止所有服务
docker-compose down

# 查看日志
docker-compose logs -f app
```

## 📚 相关文档

- [README.md](README.md) - 项目主文档
- [CLAUDE.md](CLAUDE.md) - Claude Code 开发指南
- [prd.md](prd.md) - 产品需求文档
- [docs/README.md](docs/README.md) - 文档目录
- [background/QUICK_START.md](background/QUICK_START.md) - 快速启动指南
- [background/DOCKER_QUICK_START.md](background/DOCKER_QUICK_START.md) - Docker 快速启动指南

---

**项目结构说明创建时间**: 2024年  
**维护者**: 项目团队  
**版本**: 1.0.0
