# -*- coding: utf-8 -*-
"""迁移脚本生成测试。"""

import sys
import os

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def test_alembic_ini_configuration():
    """测试 alembic.ini 配置。"""
    print("测试 alembic.ini 配置...")

    with open("alembic.ini", "r", encoding="utf-8") as f:
        content = f.read()

    # 检查关键配置
    assert "script_location = alembic" in content, "缺少 script_location 配置"
    assert "[alembic]" in content, "缺少 [alembic] 配置节"
    print("  [OK] alembic.ini 配置正常")


def test_env_py_configuration():
    """测试 env.py 配置。"""
    print("\n测试 env.py 配置...")

    with open("alembic/env.py", "r", encoding="utf-8") as f:
        content = f.read()

    # 检查必要的导入
    assert "from app.infrastructure.database.models import Base" in content, \
        "env.py 缺少 Base 导入"
    assert "target_metadata = Base.metadata" in content, \
        "env.py 缺少 target_metadata 配置"
    print("  [OK] env.py 配置正常")


def test_script_py_mako():
    """测试 script.py.mako 模板。"""
    print("\n测试 script.py.mako 模板...")

    with open("alembic/script.py.mako", "r", encoding="utf-8") as f:
        content = f.read()

    # 检查模板关键部分
    assert "def upgrade() -> None:" in content, "缺少 upgrade 函数"
    assert "def downgrade() -> None:" in content, "缺少 downgrade 函数"
    assert "revision: str" in content, "缺少 revision 变量"
    print("  [OK] script.py.mako 模板正常")


def test_versions_directory():
    """测试 versions 目录。"""
    print("\n测试 versions 目录...")

    versions_dir = "alembic/versions"
    assert os.path.isdir(versions_dir), "versions 目录不存在"

    # 检查是否有 .gitkeep 文件
    gitkeep = os.path.join(versions_dir, ".gitkeep")
    assert os.path.exists(gitkeep), "versions 目录缺少 .gitkeep 文件"
    print("  [OK] versions 目录正常")


def test_migration_generation_script():
    """测试迁移生成脚本。"""
    print("\n测试迁移生成脚本...")

    script_path = "scripts/generate_migration.py"
    assert os.path.exists(script_path), "迁移生成脚本不存在"

    with open(script_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 检查脚本功能
    assert "alembic" in content, "脚本缺少 alembic 调用"
    assert "revision" in content, "脚本缺少 revision 命令"
    print("  [OK] 迁移生成脚本正常")


def test_database_initialization_script():
    """测试数据库初始化脚本。"""
    print("\n测试数据库初始化脚本...")

    script_path = "scripts/init_db.py"
    assert os.path.exists(script_path), "数据库初始化脚本不存在"

    with open(script_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 检查脚本功能
    assert "Base.metadata.create_all" in content, "脚本缺少表创建逻辑"
    assert "init_engine" in content, "脚本缺少引擎初始化"
    print("  [OK] 数据库初始化脚本正常")


def test_dockerfile_configuration():
    """测试 Dockerfile 配置。"""
    print("\n测试 Dockerfile 配置...")

    dockerfile_path = "Dockerfile"
    assert os.path.exists(dockerfile_path), "Dockerfile 不存在"

    with open(dockerfile_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 检查关键配置
    assert "COPY alembic" in content, "Dockerfile 缺少 alembic 文件复制"
    assert "COPY alembic.ini" in content, "Dockerfile 缺少 alembic.ini 复制"
    assert "alembic upgrade head" in content, "Dockerfile 缺少数据库迁移命令"
    print("  [OK] Dockerfile 配置正常")


def main():
    """运行所有测试。"""
    print("=" * 60)
    print("迁移脚本生成测试")
    print("=" * 60)

    try:
        test_alembic_ini_configuration()
        test_env_py_configuration()
        test_script_py_mako()
        test_versions_directory()
        test_migration_generation_script()
        test_database_initialization_script()
        test_dockerfile_configuration()

        print("\n" + "=" * 60)
        print("[SUCCESS] 所有测试通过！")
        print("=" * 60)
        return 0
    except AssertionError as e:
        print(f"\n[FAIL] 测试失败: {e}")
        return 1
    except Exception as e:
        print(f"\n[ERROR] 测试出错: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())