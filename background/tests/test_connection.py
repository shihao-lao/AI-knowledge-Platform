# -*- coding: utf-8 -*-
"""数据库连接测试。"""

import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from app.infrastructure.database.session import (
    init_engine, configure_session, get_async_session, normalize_async_database_url
)


class TestDatabaseURLNormalization:
    """测试数据库 URL 规范化。"""

    def test_postgresql_asyncpg_url(self):
        """测试 PostgreSQL asyncpg URL。"""
        url = "postgresql+asyncpg://user:pass@localhost/db"
        result = normalize_async_database_url(url)
        assert result == url

    def test_postgresql_psycopg2_to_asyncpg(self):
        """测试 psycopg2 URL 转换为 asyncpg。"""
        url = "postgresql+psycopg2://user:pass@localhost/db"
        result = normalize_async_database_url(url)
        assert result == "postgresql+asyncpg://user:pass@localhost/db"

    def test_postgres_url_to_asyncpg(self):
        """测试 postgres URL 转换为 asyncpg。"""
        url = "postgres://user:pass@localhost/db"
        result = normalize_async_database_url(url)
        assert result == "postgresql+asyncpg://user:pass@localhost/db"

    def test_postgresql_url_to_asyncpg(self):
        """测试 postgresql URL 转换为 asyncpg。"""
        url = "postgresql://user:pass@localhost/db"
        result = normalize_async_database_url(url)
        assert result == "postgresql+asyncpg://user:pass@localhost/db"


class TestEngineInitialization:
    """测试引擎初始化。"""

    @patch('app.infrastructure.database.session.create_async_engine')
    def test_init_engine_default(self, mock_create_engine):
        """测试默认引擎初始化。"""
        mock_engine = MagicMock()
        mock_create_engine.return_value = mock_engine

        engine = init_engine()

        mock_create_engine.assert_called_once()
        call_args = mock_create_engine.call_args
        url = call_args[0][0]
        assert "postgresql+asyncpg" in url

    @patch('app.infrastructure.database.session.create_async_engine')
    def test_init_engine_custom_url(self, mock_create_engine):
        """测试自定义 URL 引擎初始化。"""
        mock_engine = MagicMock()
        mock_create_engine.return_value = mock_engine

        custom_url = "postgresql+asyncpg://custom:pass@localhost/custom_db"
        engine = init_engine(custom_url)

        mock_create_engine.assert_called_once()
        call_args = mock_create_engine.call_args
        url = call_args[0][0]
        assert url == custom_url

    @patch('app.infrastructure.database.session.create_async_engine')
    def test_init_engine_pool_configuration(self, mock_create_engine):
        """测试连接池配置。"""
        mock_engine = MagicMock()
        mock_create_engine.return_value = mock_engine

        init_engine()

        call_args = mock_create_engine.call_args
        kwargs = call_args[1]
        assert kwargs.get('pool_pre_ping') is True
        assert kwargs.get('pool_size') == 10
        assert kwargs.get('max_overflow') == 20
        assert kwargs.get('pool_recycle') == 3600
        assert kwargs.get('pool_timeout') == 30


class TestSessionConfiguration:
    """测试会话配置。"""

    @patch('app.infrastructure.database.session.async_sessionmaker')
    def test_configure_session(self, mock_sessionmaker):
        """测试会话配置。"""
        mock_engine = MagicMock()
        mock_factory = MagicMock()
        mock_sessionmaker.return_value = mock_factory

        factory = configure_session(mock_engine)

        mock_sessionmaker.assert_called_once_with(
            mock_engine,
            expire_on_commit=False,
            autoflush=False,
        )
        assert factory == mock_factory


class TestAsyncSessionGenerator:
    """测试异步会话生成器。"""

    @pytest.mark.asyncio
    async def test_get_async_session_without_configuration(self):
        """测试未配置时获取会话。"""
        # 重置全局状态
        import app.infrastructure.database.session as session_module
        original_factory = session_module.async_session_factory
        session_module.async_session_factory = None

        with pytest.raises(RuntimeError, match="请先调用 configure_session"):
            async for _ in get_async_session():
                pass

        # 恢复原始状态
        session_module.async_session_factory = original_factory

    @pytest.mark.asyncio
    async def test_get_async_session_with_configuration(self):
        """测试已配置时获取会话。"""
        # 模拟会话工厂
        mock_session = AsyncMock()
        mock_factory = MagicMock()
        mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_factory.return_value.__aexit__ = AsyncMock(return_value=None)

        # 配置会话
        import app.infrastructure.database.session as session_module
        original_factory = session_module.async_session_factory
        session_module.async_session_factory = mock_factory

        try:
            async for session in get_async_session():
                assert session == mock_session
                break
        finally:
            # 恢复原始状态
            session_module.async_session_factory = original_factory


class TestDatabaseHealthCheck:
    """测试数据库健康检查。"""

    def test_health_check_import(self):
        """测试健康检查导入。"""
        from app.api.routes.health import health, health_ready
        assert callable(health)
        assert callable(health_ready)

    def test_health_endpoint_structure(self):
        """测试健康检查端点结构。"""
        from app.api.routes.health import health
        import inspect

        sig = inspect.signature(health)
        # 健康检查应该没有参数
        assert len(sig.parameters) == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])