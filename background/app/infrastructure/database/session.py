# -*- coding: utf-8 -*-
"""异步数据库引擎与会话工厂。"""

from __future__ import annotations

import re
from collections.abc import AsyncGenerator
from typing import Any

from loguru import logger
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

# 默认异步 MySQL（需安装 aiomysql；PyMySQL 是其底层同步驱动）
_default_url = "mysql+aiomysql://root:root@localhost:3306/ai_knowledge_platform"


def normalize_async_database_url(url: str) -> str:
    """将 MySQL URL 归一化为 SQLAlchemy 异步驱动（aiomysql）。"""
    if "+aiomysql" in url:
        return url
    u = url.replace("mysql+pymysql://", "mysql+aiomysql://")
    u = u.replace("mysql+mysqldb://", "mysql+aiomysql://")
    u = re.sub(r"^mysql://", "mysql+aiomysql://", u)
    return u


def to_sync_database_url(url: str) -> str:
    """转为同步驱动 URL（Alembic 迁移使用同步引擎）。"""
    return url.replace("+aiomysql", "+pymysql").replace("+aiosqlite", "+pysqlite")


def init_engine(database_url: str | None = None, **engine_kwargs: Any) -> AsyncEngine:
    """创建异步引擎（应用启动时调用一次）。"""
    url = normalize_async_database_url(database_url or _default_url)
    
    # 配置连接池参数
    kwargs = {
        "echo": False,
        "pool_pre_ping": True,
        "pool_size": 10,  # 连接池大小
        "max_overflow": 20,  # 最大溢出连接数
        "pool_recycle": 3600,  # 连接回收时间（秒）
        "pool_timeout": 30,  # 获取连接超时时间（秒）
    }
    kwargs.update(engine_kwargs)
    engine = create_async_engine(url, **kwargs)
    logger.info("数据库引擎已初始化（已隐藏凭据）")
    return engine


_engine: AsyncEngine | None = None
async_session_factory: async_sessionmaker[AsyncSession] | None = None


def configure_session(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    """绑定全局 session 工厂。"""
    global _engine, async_session_factory
    _engine = engine
    async_session_factory = async_sessionmaker(
        engine,
        expire_on_commit=False,
        autoflush=False,
    )
    return async_session_factory


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """依赖注入用：获取异步会话（由路由层负责 commit）。"""
    if async_session_factory is None:
        raise RuntimeError("请先调用 configure_session(init_engine(...))")
    async with async_session_factory() as session:
        yield session


def get_session_context():
    """获取异步会话上下文管理器。"""
    if async_session_factory is None:
        raise RuntimeError("请先调用 configure_session(init_engine(...))")
    return async_session_factory()
