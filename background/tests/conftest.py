# -*- coding: utf-8 -*-
"""测试配置：统一把测试指向独立的 MySQL 测试库。

注意：这里用 ``os.environ[...] =`` 强制覆盖而不是 ``setdefault``，
因为 ``background/.env`` 里配的是开发库，测试绝不能写进开发库。
"""

import os
import sys

import pytest

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 测试库（可用 TEST_DATABASE_URL 覆盖）
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "mysql+aiomysql://root:root@localhost:3306/ai_knowledge_platform_test",
)

# 在任何应用模块导入前就固定下来
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["SECRET_KEY"] = "test-secret-key-for-testing-only"


@pytest.fixture(scope="session")
def event_loop():
    """创建事件循环。"""
    import asyncio

    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(autouse=True)
def setup_test_environment():
    """确保每个测试都指向测试库。"""
    os.environ["DATABASE_URL"] = TEST_DATABASE_URL
    yield
