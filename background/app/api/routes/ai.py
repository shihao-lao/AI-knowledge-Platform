# -*- coding: utf-8 -*-
"""AI 工具 API：文档摘要、专家 Skill 生成等辅助功能。"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger
from pydantic import BaseModel

from app.api.routes.auth import get_current_user_dependency
from app.infrastructure.llm.config import (
    LLMConfig,
    NOT_CONFIGURED_HINT,
    build_async_client,
    describe_llm_error,
    resolve_llm_config,
)
from app.models.schemas import UserResponse

router = APIRouter(tags=["ai"])

# ==================== LLM 调用 ====================


async def _llm_chat(
    config: LLMConfig,
    messages: list[dict],
    temperature: float = 0.7,
    max_tokens: int = 1024,
) -> str:
    """调用 OpenAI 兼容接口做一次性对话。"""
    async with build_async_client(config) as client:
        response = await client.chat.completions.create(
            model=config.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
    return response.choices[0].message.content or ""


# ==================== 请求/响应模型 ====================


class AISummaryRequest(BaseModel):
    action: str  # "summary" | "skill"
    title: str
    content: str = ""


class AISummaryResponse(BaseModel):
    data: str


# ==================== 路由 ====================


@router.post("/ai/generate", response_model=AISummaryResponse)
async def ai_generate(
    request: AISummaryRequest,
    current_user: UserResponse = Depends(get_current_user_dependency),
) -> AISummaryResponse:
    """AI 文档摘要 / 专家 Skill 生成。"""
    if not request.title:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="缺少必要参数 title",
        )

    truncated_content = request.content[:3000]

    config = await resolve_llm_config(current_user.id)
    if not config.configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=NOT_CONFIGURED_HINT,
        )

    if request.action == "summary":
        messages = [
            {
                "role": "system",
                "content": (
                    "你是一个专业的文档分析助手。请用简洁的中文对用户提供的文档进行摘要，"
                    "提炼核心要点，输出 3-5 条关键结论。不要重复文档标题。"
                ),
            },
            {
                "role": "user",
                "content": f"文档标题：{request.title}\n\n文档内容：\n{truncated_content}",
            },
        ]
        temperature, max_tokens = 0.5, 512
    elif request.action == "skill":
        messages = [
            {
                "role": "system",
                "content": (
                    "你是一个 AI 提示词工程专家。根据用户提供的文档内容，生成一个专业的“专家 Skill”（即 System Prompt），要求：\n"
                    "1. 以“你是一位……”开头，定义 AI 的专家身份和背景\n"
                    "2. 明确列出该专家的核心能力（3-5 条）\n"
                    "3. 定义回答风格和输出格式要求\n"
                    "4. 包含与该领域相关的专业术语和知识范围限定\n"
                    "5. 整体控制在 300-500 字，结构清晰，可直接复制使用\n"
                    "不要输出任何解释，只输出 Skill 内容本身。"
                ),
            },
            {
                "role": "user",
                "content": f"文档标题：{request.title}\n\n文档内容：\n{truncated_content}\n\n请基于以上文档生成对应的专家 Skill。",
            },
        ]
        temperature, max_tokens = 0.6, 800
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"未知 action: {request.action}",
        )

    try:
        result = await _llm_chat(config, messages, temperature=temperature, max_tokens=max_tokens)
    except Exception as exc:  # noqa: BLE001 - 统一转成可读提示
        logger.exception("AI 生成失败: {}", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"模型调用失败：{describe_llm_error(exc)}",
        ) from exc

    return AISummaryResponse(data=result)
