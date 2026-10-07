# -*- coding: utf-8 -*-
"""测试配置：统一把测试指向独立的 MySQL 测试库。

注意：这里用 ``os.environ[...] =`` 强制覆盖而不是 ``setdefault``，
因为 ``background/.env`` 里配的是开发库，测试绝不能写进开发库。
"""

import os
import sys

import pytest
import pytest_asyncio

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


@pytest_asyncio.fixture
async def backend_database(monkeypatch):
    """Real isolated database with the same autoflush setting as production."""
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from app.infrastructure.database import session as db
    from app.infrastructure.database.models import Base, Knowledge, User

    engine = create_async_engine(TEST_DATABASE_URL)
    factory = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)
    monkeypatch.setattr(db, 'async_session_factory', factory)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)
    async with factory() as session:
        session.add(User(id='owner', name='Owner', email='owner@test.com', password_hash='x'))
        await session.flush()
        session.add(Knowledge(id='kb', user_id='owner', name='KB'))
        await session.commit()
    try:
        yield factory
    finally:
        await engine.dispose()


@pytest.fixture(scope="session", autouse=True)
def reset_test_schema():
    """会话开始时清空测试库中实际存在的所有表。

    多个测试模块用 ``Base.metadata.drop_all`` + ``create_all`` 建表，但
    ``drop_all`` 只能删**当前模型认识**的表。一旦库里残留了已被移除功能的表
    （例如提交 ebbaeb3 引入、后来整体删掉的 ``interview_sessions`` /
    ``interview_turns``），它指向 ``questions`` 的外键就会让 ``drop_all`` 报
    "Cannot drop table ... referenced by a foreign key constraint"，
    使整批用例在 setup 阶段集体失败。

    这里按库里实际存在的表来删，让测试对 schema 漂移有自愈能力。
    只作用于测试库（DATABASE_URL 已被强制覆盖）。
    """
    from sqlalchemy.engine import make_url

    url = make_url(TEST_DATABASE_URL)
    if not url.drivername.startswith("mysql"):
        # 非 MySQL（例如临时切到 SQLite）时不需要这层清理
        yield
        return

    import pymysql

    conn = pymysql.connect(
        host=url.host or "localhost",
        port=url.port or 3306,
        user=url.username,
        password=url.password,
        database=url.database,
    )
    try:
        with conn.cursor() as cur:
            cur.execute("SET FOREIGN_KEY_CHECKS = 0")
            cur.execute("SHOW TABLES")
            for (table,) in cur.fetchall():
                cur.execute("DROP TABLE IF EXISTS `%s`" % table)
            cur.execute("SET FOREIGN_KEY_CHECKS = 1")
        conn.commit()
    finally:
        conn.close()

    yield
