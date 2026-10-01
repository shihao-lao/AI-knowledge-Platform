# -*- coding: utf-8 -*-
"""大模型配置解析：用户级配置优先，服务端环境变量兜底。

所有 LLM 调用点都应通过 :func:`resolve_llm_config` 取得配置，再交给
:func:`build_async_client` / :func:`build_chat_model` 创建客户端，
不要再直接读 ``os.getenv("MIMO_*")``，否则用户在页面上配置的模型不会生效。
"""

from __future__ import annotations

import os
from dataclasses import dataclass, replace
from typing import Any, Literal

from openai import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    AsyncOpenAI,
    AuthenticationError,
    NotFoundError,
)
from sqlalchemy import select

from app.infrastructure.database.models import UserLLMConfig
from app.infrastructure.database.session import get_session_context

# user = 用户自己配置的；server = 服务端 .env 兜底；none = 都没有，AI 不可用
ConfigSource = Literal["user", "server", "none"]

#: 缺少配置时统一的提示文案，前端会直接展示
NOT_CONFIGURED_HINT = "尚未配置大模型，请到「设置 → 模型配置」填写 API Key"


@dataclass(slots=True)
class LLMConfig:
    """一次 LLM 调用所需的全部参数。"""

    base_url: str
    api_key: str
    model: str
    temperature: float = 0.7
    max_tokens: int = 2048
    timeout: int = 60
    provider: str = "custom"
    source: ConfigSource = "none"

    @property
    def configured(self) -> bool:
        """三项齐全才算可用，否则调用必然失败。"""
        return bool(self.base_url and self.api_key and self.model)

    def with_overrides(self, **kwargs: Any) -> "LLMConfig":
        """返回替换了部分字段的新配置（用于单次调用临时覆盖温度等）。"""
        return replace(self, **{k: v for k, v in kwargs.items() if v is not None})


def ensure_loopback_proxy_bypass() -> None:
    """让回环地址绕过系统代理。

    Windows 上 urllib/httpx 会读取注册表里的系统代理（clash 之类），而系统代理
    通常无法访问 127.0.0.1，会直接返回 502，导致 Ollama / LM Studio 等本地模型
    服务完全不可用。这里只把回环地址补进 NO_PROXY，外部服务（如 hf-mirror）仍然
    走代理，两者互不影响。
    """
    loopback = ["127.0.0.1", "localhost", "::1"]
    # Windows 的环境变量名大小写不敏感，NO_PROXY 与 no_proxy 是同一个变量，
    # 因此要先把已有值取出来合并，再统一写回，避免后一次赋值覆盖前一次。
    existing = os.getenv("NO_PROXY") or os.getenv("no_proxy") or ""
    current = [item.strip() for item in existing.split(",") if item.strip()]
    missing = [host for host in loopback if host not in current]
    if not missing:
        return

    merged = ",".join(current + missing)
    os.environ["NO_PROXY"] = merged
    os.environ["no_proxy"] = merged


# 必须在任何 httpx 客户端构造之前生效，因此放在模块导入时执行（幂等）
ensure_loopback_proxy_bypass()


def mask_api_key(key: str) -> str:
    """生成给前端展示的脱敏密钥；完整密钥永远不出后端。"""
    if not key:
        return ""
    if len(key) <= 8:
        return "*" * len(key)
    return f"{key[:4]}{'*' * 6}{key[-4:]}"


def env_default_config() -> LLMConfig:
    """服务端 .env 兜底配置，保持 MIMO 优先的历史行为。"""
    if os.getenv("MIMO_API_KEY"):
        return LLMConfig(
            base_url=os.getenv("MIMO_BASE_URL", "https://api.xiaomimimo.com/v1"),
            api_key=os.getenv("MIMO_API_KEY", ""),
            model=os.getenv("MIMO_MODEL", "mimo-v2.5"),
            temperature=float(os.getenv("LLM_TEMPERATURE", "0.7")),
            max_tokens=int(os.getenv("LLM_MAX_TOKENS", "2048")),
            timeout=int(os.getenv("LLM_TIMEOUT", "60")),
            provider="mimo",
            source="server",
        )

    base_url = os.getenv("OPENAI_API_BASE") or os.getenv("OPENAI_BASE_URL") or "https://api.openai.com/v1"
    api_key = os.getenv("OPENAI_API_KEY", "")
    return LLMConfig(
        base_url=base_url,
        api_key=api_key,
        model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        temperature=float(os.getenv("LLM_TEMPERATURE", "0.7")),
        max_tokens=int(os.getenv("LLM_MAX_TOKENS", "2048")),
        timeout=int(os.getenv("LLM_TIMEOUT", "60")),
        provider="openai",
        source="server" if api_key else "none",
    )


def config_from_row(row: UserLLMConfig) -> LLMConfig:
    """把数据库记录转换为 LLMConfig。"""
    return LLMConfig(
        base_url=(row.base_url or "").strip(),
        api_key=(row.api_key or "").strip(),
        model=(row.model or "").strip(),
        temperature=row.temperature if row.temperature is not None else 0.7,
        max_tokens=row.max_tokens or 2048,
        timeout=row.timeout or 60,
        provider=row.provider or "custom",
        source="user",
    )


async def get_user_config_row(user_id: str) -> UserLLMConfig | None:
    """读取用户的模型配置记录。"""
    async with get_session_context() as session:
        result = await session.execute(
            select(UserLLMConfig).where(UserLLMConfig.user_id == user_id)
        )
        return result.scalar_one_or_none()


async def resolve_llm_config(user_id: str | None) -> LLMConfig:
    """解析出实际生效的 LLM 配置。

    用户配置齐全时用它；否则回落到服务端 .env，避免用户没配就直接不可用。
    """
    if user_id:
        row = await get_user_config_row(user_id)
        if row is not None:
            user_config = config_from_row(row)
            if user_config.configured:
                return user_config

    return env_default_config()


def build_async_client(config: LLMConfig, timeout: int | None = None) -> AsyncOpenAI:
    """创建 OpenAI 兼容异步客户端。"""
    return AsyncOpenAI(
        api_key=config.api_key,
        base_url=config.base_url,
        timeout=timeout or config.timeout,
        max_retries=1,
    )


def describe_llm_error(exc: Exception) -> str:
    """把 SDK 异常翻译成用户能看懂的中文提示。"""
    if isinstance(exc, AuthenticationError):
        return "API Key 无效或已过期（401）"
    if isinstance(exc, NotFoundError):
        return "接口地址或模型名不存在（404），请检查 Base URL 是否包含 /v1 以及模型名是否正确"
    if isinstance(exc, APITimeoutError):
        return "请求超时，请检查网络或调大超时时间"
    if isinstance(exc, APIConnectionError):
        return "无法连接到该地址，请检查 Base URL、网络或代理设置"
    if isinstance(exc, APIStatusError):
        return f"服务端返回 {exc.status_code}：{str(getattr(exc, 'message', exc))[:200]}"
    return str(exc)[:200]


def build_chat_model(config: LLMConfig, streaming: bool = False, **overrides: Any):
    """创建 LangChain 的 ChatOpenAI 实例（延迟导入，避免非聊天链路加载 langchain）。"""
    from langchain_openai import ChatOpenAI

    return ChatOpenAI(
        base_url=config.base_url,
        api_key=config.api_key,
        model=config.model,
        temperature=overrides.get("temperature", config.temperature),
        max_tokens=overrides.get("max_tokens", config.max_tokens),
        timeout=config.timeout,
        streaming=streaming,
    )
