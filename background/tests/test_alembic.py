# -*- coding: utf-8 -*-
"""Alembic 配置测试。"""

import pytest
import os
from pathlib import Path


class TestAlembicConfiguration:
    """测试 Alembic 配置。"""

    def test_alembic_ini_exists(self):
        """测试 alembic.ini 文件存在。"""
        alembic_ini = Path("alembic.ini")
        assert alembic_ini.exists(), "alembic.ini 文件不存在"

    def test_alembic_directory_exists(self):
        """测试 alembic 目录存在。"""
        alembic_dir = Path("alembic")
        assert alembic_dir.exists(), "alembic 目录不存在"
        assert alembic_dir.is_dir(), "alembic 不是目录"

    def test_env_py_exists(self):
        """测试 env.py 文件存在。"""
        env_py = Path("alembic/env.py")
        assert env_py.exists(), "alembic/env.py 文件不存在"

    def test_script_py_mako_exists(self):
        """测试 script.py.mako 文件存在。"""
        script_mako = Path("alembic/script.py.mako")
        assert script_mako.exists(), "alembic/script.py.mako 文件不存在"

    def test_versions_directory_exists(self):
        """测试 versions 目录存在。"""
        versions_dir = Path("alembic/versions")
        assert versions_dir.exists(), "alembic/versions 目录不存在"
        assert versions_dir.is_dir(), "alembic/versions 不是目录"

    def test_alembic_ini_content(self):
        """测试 alembic.ini 内容。"""
        with open("alembic.ini", "r", encoding="utf-8") as f:
            content = f.read()

        # 检查关键配置
        assert "script_location = alembic" in content, "缺少 script_location 配置"
        assert "[alembic]" in content, "缺少 [alembic] 配置节"

    def test_env_py_imports(self):
        """测试 env.py 导入。"""
        with open("alembic/env.py", "r", encoding="utf-8") as f:
            content = f.read()

        # 检查必要的导入
        assert "from app.infrastructure.database.models import Base" in content, \
            "env.py 缺少 Base 导入"
        assert "target_metadata = Base.metadata" in content, \
            "env.py 缺少 target_metadata 配置"


class TestDatabaseSession:
    """测试数据库会话配置。"""

    def test_session_module_exists(self):
        """测试 session 模块存在。"""
        session_path = Path("app/infrastructure/database/session.py")
        assert session_path.exists(), "session.py 文件不存在"

    def test_session_imports(self):
        """测试 session 模块导入。"""
        with open("app/infrastructure/database/session.py", "r", encoding="utf-8") as f:
            content = f.read()

        # 检查必要的导入
        assert "from sqlalchemy.ext.asyncio import" in content, \
            "session.py 缺少 SQLAlchemy 导入"
        assert "create_async_engine" in content, \
            "session.py 缺少 create_async_engine"

    def test_session_configuration(self):
        """测试会话配置。"""
        with open("app/infrastructure/database/session.py", "r", encoding="utf-8") as f:
            content = f.read()

        # 检查连接池配置
        assert "pool_pre_ping" in content, "缺少 pool_pre_ping 配置"
        assert "pool_size" in content, "缺少 pool_size 配置"
        assert "max_overflow" in content, "缺少 max_overflow 配置"


class TestDatabaseInitialization:
    """测试数据库初始化脚本。"""

    def test_init_db_script_exists(self):
        """测试 init_db.py 脚本存在。"""
        init_script = Path("scripts/init_db.py")
        assert init_script.exists(), "scripts/init_db.py 不存在"

    def test_init_db_script_content(self):
        """测试 init_db.py 脚本内容。"""
        with open("scripts/init_db.py", "r", encoding="utf-8") as f:
            content = f.read()

        # 检查关键功能
        assert "Base.metadata.create_all" in content, \
            "init_db.py 缺少表创建逻辑"
        assert "init_engine" in content, \
            "init_db.py 缺少引擎初始化"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])