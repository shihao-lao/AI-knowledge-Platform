# -*- coding: utf-8 -*-
"""用户级大模型配置的回归测试。

不依赖外部网络与真实模型服务：连通性测试通过替换客户端来覆盖成功与各类失败。
"""

import os
from types import SimpleNamespace

import httpx
import pytest
import pytest_asyncio
from openai import APIConnectionError, AuthenticationError, NotFoundError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.infrastructure.database import session as db
from app.infrastructure.database.models import Base, User
from app.infrastructure.llm import config as llm_config
from app.models.schemas import LLMConfigUpdate, LLMTestRequest, UserResponse
from app.services import llm_settings_service as service

USER = "owner"
SECRET_KEY_VALUE = "sk-super-secret-value-1234567890"


@pytest_asyncio.fixture
async def database(monkeypatch):
    engine = create_async_engine(os.environ["DATABASE_URL"])
    factory = async_sessionmaker(engine, expire_on_commit=False)
    monkeypatch.setattr(db, "async_session_factory", factory)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    async with factory() as session:
        session.add(User(id=USER, name="Owner", email="o@test.com", password_hash="x"))
        await session.commit()
    yield factory
    await engine.dispose()


def _payload(**overrides) -> LLMConfigUpdate:
    data = {
        "provider": "custom",
        "base_url": "http://127.0.0.1:8899/v1",
        "api_key": SECRET_KEY_VALUE,
        "model": "mock-model",
        "temperature": 0.3,
        "max_tokens": 512,
        "timeout": 30,
    }
    data.update(overrides)
    return LLMConfigUpdate(**data)


# ==================== 纯函数 ====================


def test_mask_api_key_hides_middle():
    assert llm_config.mask_api_key("") == ""
    assert llm_config.mask_api_key("short") == "*****"
    masked = llm_config.mask_api_key("sk-abcdefghijklmnop")
    assert masked.startswith("sk-a") and masked.endswith("mnop")
    assert "efghijkl" not in masked


def test_loopback_proxy_bypass_keeps_existing_entries(monkeypatch):
    # Windows 上 NO_PROXY 与 no_proxy 是同一个变量，这里只按大写名设置一次
    monkeypatch.setenv("NO_PROXY", "example.com")

    llm_config.ensure_loopback_proxy_bypass()

    value = os.getenv("NO_PROXY") or os.getenv("no_proxy") or ""
    assert "example.com" in value  # 不覆盖用户已有配置
    assert "127.0.0.1" in value and "localhost" in value


def test_env_fallback_prefers_mimo(monkeypatch):
    monkeypatch.setenv("MIMO_API_KEY", "env-key")
    monkeypatch.setenv("MIMO_BASE_URL", "https://env.example/v1")
    monkeypatch.setenv("MIMO_MODEL", "env-model")

    config = llm_config.env_default_config()

    assert config.source == "server"
    assert config.base_url == "https://env.example/v1"
    assert config.model == "env-model"
    assert config.configured is True


def test_env_fallback_without_any_key_is_unconfigured(monkeypatch):
    for name in ("MIMO_API_KEY", "OPENAI_API_KEY"):
        monkeypatch.delenv(name, raising=False)

    config = llm_config.env_default_config()

    assert config.source == "none"
    assert config.configured is False


# ==================== 读写与脱敏 ====================


@pytest.mark.asyncio
async def test_saved_key_is_never_returned_in_plaintext(database):
    saved = await service.save_llm_settings(USER, _payload())

    assert saved.api_key_set is True
    assert saved.source == "user"
    # 整个响应体里都不能出现明文密钥
    assert SECRET_KEY_VALUE not in saved.model_dump_json()
    assert saved.api_key_masked != SECRET_KEY_VALUE

    read_back = await service.read_llm_settings(USER)
    assert SECRET_KEY_VALUE not in read_back.model_dump_json()
    assert read_back.model == "mock-model"


@pytest.mark.asyncio
async def test_omitting_api_key_keeps_the_stored_one(database):
    await service.save_llm_settings(USER, _payload())

    # 前端留空表示「不修改」
    updated = await service.save_llm_settings(USER, _payload(api_key=None, model="another-model"))

    assert updated.api_key_set is True
    assert updated.api_key_masked == llm_config.mask_api_key(SECRET_KEY_VALUE)
    assert updated.model == "another-model"


@pytest.mark.asyncio
async def test_clear_api_key_removes_it_and_falls_back(database, monkeypatch):
    # 断言依赖「服务端也没有可用密钥」，先清掉环境里可能存在的兜底配置
    monkeypatch.delenv("MIMO_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    await service.save_llm_settings(USER, _payload())

    cleared = await service.save_llm_settings(USER, _payload(clear_api_key=True))

    assert cleared.api_key_set is False
    assert cleared.configured is False
    # 没配全时实际生效的是服务端默认，PUT 与 GET 必须一致
    read_back = await service.read_llm_settings(USER)
    assert cleared.source == read_back.source
    assert cleared.configured == read_back.configured


@pytest.mark.asyncio
async def test_reset_restores_server_default(database, monkeypatch):
    monkeypatch.setenv("MIMO_API_KEY", "env-key")
    monkeypatch.setenv("MIMO_MODEL", "env-model")
    await service.save_llm_settings(USER, _payload())

    reset = await service.clear_llm_settings(USER)

    assert reset.source == "server"
    assert reset.model == "env-model"
    assert reset.is_custom is False


@pytest.mark.asyncio
async def test_base_url_is_normalised(database):
    saved = await service.save_llm_settings(USER, _payload(base_url="https://api.example.com/v1///"))
    assert saved.base_url == "https://api.example.com/v1"


# ==================== 结构校验 ====================


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "bad",
    [
        {"base_url": "ftp://nope"},
        {"base_url": ""},
        {"model": ""},
    ],
)
async def test_invalid_config_is_rejected(database, bad):
    with pytest.raises(ValueError):
        await service.save_llm_settings(USER, _payload(**bad))


# ==================== 配置解析（所有 LLM 调用点的入口） ====================


@pytest.mark.asyncio
async def test_resolve_prefers_complete_user_config(database, monkeypatch):
    monkeypatch.setenv("MIMO_API_KEY", "env-key")
    monkeypatch.setenv("MIMO_MODEL", "env-model")
    await service.save_llm_settings(USER, _payload(model="user-model", temperature=0.2))

    resolved = await llm_config.resolve_llm_config(USER)

    assert resolved.source == "user"
    assert resolved.model == "user-model"
    assert resolved.api_key == SECRET_KEY_VALUE
    assert resolved.temperature == 0.2


@pytest.mark.asyncio
async def test_resolve_falls_back_when_user_left_key_empty(database, monkeypatch):
    monkeypatch.setenv("MIMO_API_KEY", "env-key")
    monkeypatch.setenv("MIMO_MODEL", "env-model")
    await service.save_llm_settings(USER, _payload(clear_api_key=True))

    resolved = await llm_config.resolve_llm_config(USER)

    assert resolved.source == "server"
    assert resolved.model == "env-model"


@pytest.mark.asyncio
async def test_resolve_without_user_id_uses_server_default(database, monkeypatch):
    monkeypatch.setenv("MIMO_API_KEY", "env-key")
    monkeypatch.setenv("MIMO_MODEL", "env-model")

    resolved = await llm_config.resolve_llm_config(None)

    assert resolved.source == "server"
    assert resolved.model == "env-model"


# ==================== 连通性测试的错误映射 ====================


class _FakeClient:
    """替换 AsyncOpenAI 的异步上下文管理器替身，可按需抛出指定异常。"""

    def __init__(self, exc: Exception | None = None, content: str = "正常"):
        async def create(**_kwargs):
            if exc is not None:
                raise exc
            return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])

        self.chat = SimpleNamespace(completions=SimpleNamespace(create=create))

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return False


def _config():
    return llm_config.LLMConfig(base_url="http://127.0.0.1:8899/v1", api_key="k", model="mock-model")


@pytest.mark.asyncio
async def test_connection_success_reports_reply_and_latency(monkeypatch):
    monkeypatch.setattr(service, "build_async_client", lambda *_a, **_k: _FakeClient(content="正常"))

    result = await service.test_connection(_config())

    assert result.ok is True
    assert result.reply == "正常"
    assert result.model == "mock-model"
    assert result.latency_ms >= 0


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("exc", "expected"),
    [
        (
            AuthenticationError("401", response=httpx.Response(401, request=httpx.Request("POST", "http://x")), body=None),
            "API Key",
        ),
        (
            NotFoundError("404", response=httpx.Response(404, request=httpx.Request("POST", "http://x")), body=None),
            "模型名",
        ),
        (APIConnectionError(request=httpx.Request("POST", "http://x")), "无法连接"),
    ],
)
async def test_connection_maps_errors_to_readable_chinese(monkeypatch, exc, expected):
    monkeypatch.setattr(service, "build_async_client", lambda *_a, **_k: _FakeClient(exc=exc))

    result = await service.test_connection(_config())

    assert result.ok is False
    assert expected in result.message


@pytest.mark.asyncio
async def test_connection_rejects_invalid_config_before_network():
    with pytest.raises(ValueError):
        await service.test_connection(
            llm_config.LLMConfig(base_url="ftp://nope", api_key="k", model="m")
        )


@pytest.mark.asyncio
@pytest.mark.parametrize('saved_user', [False, True])
@pytest.mark.parametrize('endpoint', ['test', 'models'])
async def test_changed_address_never_receives_inherited_key(database, monkeypatch, saved_user, endpoint):
    from fastapi import FastAPI
    from app.api.routes import settings
    from app.api.routes.auth import get_current_user_dependency
    monkeypatch.setenv('MIMO_API_KEY', 'server-secret')
    monkeypatch.setenv('MIMO_BASE_URL', 'https://server.example/v1')
    if saved_user:
        await service.save_llm_settings(USER, _payload())
    def no_network(*args, **kwargs):
        pytest.fail('Must reject the changed address before constructing a client')
    monkeypatch.setattr(service, 'build_async_client', no_network)
    monkeypatch.setattr(service, 'AsyncOpenAI', no_network)
    app = FastAPI()
    app.include_router(settings.router)
    app.dependency_overrides[get_current_user_dependency] = lambda: UserResponse(
        id=USER, name='Owner', email='o@test.com', created_at='2026-01-01')
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url='http://test') as client:
        response = await client.post(f'/settings/llm/{endpoint}', json={
            'base_url': 'https://different.example/v1', 'model': 'm',
        })
    assert response.status_code == 400
    assert 'API Key' in response.json()['detail']


@pytest.mark.asyncio
async def test_candidate_key_is_bound_to_full_address(database, monkeypatch):
    monkeypatch.setenv('MIMO_API_KEY', 'server-secret')
    monkeypatch.setenv('MIMO_BASE_URL', 'https://server.example/v1')
    same = await service.resolve_candidate_config(USER, LLMTestRequest(
        base_url='https://server.example/v1/'))
    assert same.api_key == 'server-secret'
    changed = await service.resolve_candidate_config(USER, LLMTestRequest(
        base_url='https://server.example/other'))
    assert changed.api_key == ''
    own = await service.resolve_candidate_config(USER, LLMTestRequest(
        base_url='https://different.example/v1', api_key='own-key'))
    assert own.api_key == 'own-key' and own.source == 'user'


@pytest.mark.asyncio
async def test_saving_changed_address_requires_new_key(database):
    await service.save_llm_settings(USER, _payload())
    with pytest.raises(ValueError, match='API Key'):
        await service.save_llm_settings(USER, _payload(
            base_url='https://different.example/v1', api_key=None))
    original = await llm_config.resolve_llm_config(USER)
    assert original.base_url == _payload().base_url
    assert original.api_key == SECRET_KEY_VALUE
    await service.save_llm_settings(USER, _payload(
        base_url='https://different.example/v1', api_key='new-key'))
    updated = await llm_config.resolve_llm_config(USER)
    assert updated.api_key == 'new-key'
