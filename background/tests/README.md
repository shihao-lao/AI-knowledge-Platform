# 测试文件目录

本目录包含项目的所有测试文件。

## 📋 测试文件列表

### 核心测试
- `test_api_routes_working.py` - API 路由测试（推荐）
- `test_db_config.py` - 数据库配置测试
- `test_schemas.py` - Pydantic 模型测试
- `test_migration.py` - 迁移脚本测试

### 辅助测试
- `test_connection.py` - 数据库连接测试
- `test_indexes.py` - 索引配置测试
- `test_models.py` - 数据库模型测试

## 🚀 运行测试

### 运行所有测试
```bash
cd background
python -m pytest tests/
```

### 运行特定测试
```bash
# 运行 API 路由测试
python tests/test_api_routes_working.py

# 运行数据库配置测试
python tests/test_db_config.py

# 运行 Pydantic 模型测试
python tests/test_schemas.py
```

### 运行快速测试
```bash
# 测试应用导入
python test_imports.py

# 测试数据库连接
python scripts/test_connection.py
```

## 📊 测试覆盖率

- ✅ API 路由测试: 32 个端点
- ✅ 数据库配置测试: 24 个测试用例
- ✅ Pydantic 模型测试: 所有模型
- ✅ 迁移脚本测试: 完整迁移流程

## 🔧 测试工具

- **pytest**: 测试框架
- **httpx**: HTTP 客户端（用于 API 测试）
- **SQLAlchemy**: 数据库测试

## 📝 测试规范

1. 每个测试文件应该有清晰的文档字符串
2. 测试函数应该以 `test_` 开头
3. 使用描述性的测试名称
4. 测试应该独立，不依赖其他测试

## 🎯 测试目标

- ✅ 代码覆盖率 > 80%
- ✅ 所有 API 端点测试
- ✅ 数据库模型测试
- ✅ 集成测试

---

**测试目录创建时间**: 2024年  
**维护者**: 项目团队