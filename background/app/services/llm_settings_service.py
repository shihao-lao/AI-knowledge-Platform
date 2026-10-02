# -*- coding: utf-8 -*-
"""用户大模型配置：读写、连通性测试与模型列表拉取。"""

from __future__ import annotations

import time

from loguru import logger
from openai import AsyncOpenAI
from sqlalchemy import select

from app.infrastructure.database.models import UserLLMConfig
from app.infrastructure.database.session import get_session_context
from app.infrastructure.llm.config import (
    LLMConfig,
    build_async_client,
    config_from_row,
    describe_llm_error,
    env_default_config,
    mask_api_key,
)
from app.models.schemas import (
    LLMConfigResponse,
    LLMConfigUpdate,
    LLMModelsResponse,
    LLMTestRequest,
    LLMTestResponse,
)

#: 连通性测试用的最小请求，只要求模型回一句话
PING_PROMPT = "请只回复两个字：正常"


def _to_response(config: LLMConfig, is_custom: bool) -> LLMConfigResponse:
    return LLMConfigResponse(
        provider=config.provider,
        base_url=config.base_url,
        model=config.model,
        temperature=config.temperature,
        max_tokens=config.max_tokens,
        timeout=config.timeout,
        api_key_set=bool(config.api_key),
        api_key_masked=mask_api_key(config.api_key),
        source=config.source,
        configured=config.configured,
        is_custom=is_custom,
    )


def normalize_base_url(base_url: str) -> str:
    """统一去掉尾部斜杠，避免拼出 //chat/completions。"""
    return (base_url or "").strip().rstrip("/")


def validate_config(config: LLMConfig) -> None:
    """提前拦住明显不合法的配置，给出可读的错误。"""
    if not config.base_url:
        raise ValueError("请填写 API Base URL")
    if not config.base_url.startswith(("http://", "https://")):
        raise ValueError("API Base URL 必须以 http:// 或 https:// 开头")
    if not config.model:
        raise ValueError("请填写模型名称")


async def read_llm_settings(user_id: str) -> LLMConfigResponse:
    """读取当前生效的配置（用户配置优先，否则回落服务端默认）。"""
    async with get_session_context() as session:
        result = await session.execute(
            select(UserLLMConfig).where(UserLLMConfig.user_id == user_id)
        )
        row = result.scalar_one_or_none()

    if row is None:
        return _to_response(env_default_config(), is_custom=False)

    user_config = config_from_row(row)
    if user_config.configured:
        return _to_response(user_config, is_custom=True)

    # 用户存过但没填全（例如只填了 Base URL），仍以服务端默认为准，但标记已自定义
    return _to_response(env_default_config(), is_custom=True)


async def save_llm_settings(user_id: str, payload: LLMConfigUpdate) -> LLMConfigResponse:
    """保存用户配置。api_key 留空表示沿用已保存的密钥。"""
    base_url = normalize_base_url(payload.base_url)
    model = (payload.model or "").strip()

    # 先做结构校验，避免把非法地址写进库；api_key 允许稍后再补
    validate_config(LLMConfig(base_url=base_url, api_key="", model=model))

    async with get_session_context() as session:
        result = await session.execute(
            select(UserLLMConfig).where(UserLLMConfig.user_id == user_id)
        )
        row = result.scalar_one_or_none()
        if row is None:
            row = UserLLMConfig(user_id=user_id)
            session.add(row)

        if (row.api_key and normalize_base_url(row.base_url) != base_url
                and not payload.clear_api_key and not (payload.api_key or '').strip()):
            raise ValueError("更换服务地址后必须填写该地址的 API Key")

        if payload.clear_api_key:
            row.api_key = ""
        elif payload.api_key is not None and payload.api_key.strip():
            row.api_key = payload.api_key.strip()

        row.provider = payload.provider or "custom"
        row.base_url = base_url
        row.model = model
        row.temperature = payload.temperature
        row.max_tokens = payload.max_tokens
        row.timeout = payload.timeout

        await session.commit()
        await session.refresh(row)
        user_config = config_from_row(row)

    # 与 GET 保持一致：没配全时实际生效的仍是服务端默认
    effective = user_config if user_config.configured else env_default_config()
    return _to_response(effective, is_custom=True)


async def clear_llm_settings(user_id: str) -> LLMConfigResponse:
    """删除用户配置，回落到服务端默认。"""
    async with get_session_context() as session:
        result = await session.execute(
            select(UserLLMConfig).where(UserLLMConfig.user_id == user_id)
        )
        row = result.scalar_one_or_none()
        if row is not None:
            await session.delete(row)
            await session.commit()

    return _to_response(env_default_config(), is_custom=False)


async def resolve_candidate_config(user_id: str, payload: LLMTestRequest | None) -> LLMConfig:
    """把「已保存配置 + 请求里的临时覆盖」合并成待测配置。

    这样用户可以在保存前先点「测试连接」，密钥留空时沿用已保存的那把。
    """
    async with get_session_context() as session:
        result = await session.execute(
            select(UserLLMConfig).where(UserLLMConfig.user_id == user_id)
        )
        row = result.scalar_one_or_none()

    saved = config_from_row(row) if row is not None else env_default_config()

    if payload is None:
        return saved

    if payload.base_url:
        candidate_url = normalize_base_url(payload.base_url)
        if candidate_url != normalize_base_url(saved.base_url):
            # 密钥绑定完整 Base URL，包括协议、端口和路径；不得跨地址继承。
            saved.api_key = ""
            saved.source = "user"
        saved.base_url = candidate_url
    if payload.api_key is not None and payload.api_key.strip():
        saved.api_key = payload.api_key.strip()
        saved.source = "user"
    if payload.model:
        saved.model = payload.model.strip()
    if payload.provider:
        saved.provider = payload.provider
    if payload.temperature is not None:
        saved.temperature = payload.temperature
    if payload.max_tokens is not None:
        saved.max_tokens = payload.max_tokens
    if payload.timeout is not None:
        saved.timeout = payload.timeout

    return saved


async def test_connection(config: LLMConfig) -> LLMTestResponse:
    """发一个最小请求验证配置真的可用。"""
    validate_config(config)
    if not config.api_key:
        raise ValueError("请填写当前服务地址的 API Key；更换地址不能沿用旧密钥")

    # 测试用短超时，避免前端一直转圈
    timeout = min(config.timeout, 30)
    started = time.perf_counter()
    try:
        async with build_async_client(config, timeout=timeout) as client:
            response = await client.chat.completions.create(
                model=config.model,
                messages=[{"role": "user", "content": PING_PROMPT}],
                temperature=0,
                max_tokens=32,
            )
    except Exception as exc:  # noqa: BLE001 - 需要把各类 SDK 异常都转成提示
        logger.warning("LLM 连通性测试失败: {}", exc)
        return LLMTestResponse(
            ok=False,
            message=describe_llm_error(exc),
            latency_ms=int((time.perf_counter() - started) * 1000),
            model=config.model,
        )

    latency = int((time.perf_counter() - started) * 1000)
    reply = ""
    try:
        reply = (response.choices[0].message.content or "").strip()[:200]
    except (IndexError, AttributeError):
        reply = ""

    return LLMTestResponse(
        ok=True,
        message=f"连接成功，模型 {config.model} 可用",
        latency_ms=latency,
        model=config.model,
        reply=reply,
    )


async def fetch_models(config: LLMConfig) -> LLMModelsResponse:
    """调用 /models 拉取服务商支持的模型列表。"""
    if not config.base_url:
        raise ValueError("请先填写 API Base URL")
    if not config.api_key:
        raise ValueError("请先填写 API Key")

    timeout = min(config.timeout, 30)
    try:
        async with AsyncOpenAI(
            api_key=config.api_key,
            base_url=config.base_url,
            timeout=timeout,
            max_retries=1,
        ) as client:
            response = await client.models.list()
    except Exception as exc:  # noqa: BLE001
        logger.warning("拉取模型列表失败: {}", exc)
        return LLMModelsResponse(ok=False, message=describe_llm_error(exc), data=[])

    ids = sorted({item.id for item in response.data if getattr(item, "id", None)})
    return LLMModelsResponse(
        ok=True,
        message=f"共获取到 {len(ids)} 个模型",
        data=ids,
    )
