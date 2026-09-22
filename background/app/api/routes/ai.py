# -*- coding: utf-8 -*-
"""AI 工具 API：文档摘要、专家 Skill 生成等辅助功能。"""

from __future__ import annotations

import os

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger
from pydantic import BaseModel

from app.api.routes.auth import get_current_user_dependency
from app.models.schemas import UserResponse

router = APIRouter(tags=["ai"])

# ==================== LLM 调用 ====================


def _get_llm_config() -> dict:
    """从环境变量读取 LLM 配置。"""
    return {
        "base_url": os.getenv("MIMO_BASE_URL", "https://api.xiaomimimo.com/v1"),
        "api_key": os.getenv("MIMO_API_KEY", ""),
        "model": os.getenv("MIMO_MODEL", "mimo-v2.5"),
    }


async def _llm_chat(messages: list[dict], temperature: float = 0.7, max_tokens: int = 1024) -> str:
    """调用 LLM 进行对话（OpenAI 兼容 API）。"""
    import httpx

    config = _get_llm_config()
    if not config["api_key"]:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LLM API Key 未配置",
        )

    payload = {
        "model": config["model"],
        "messages": messages,
        "stream": False,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{config['base_url']}/chat/completions",
            headers={
                "Authorization": f"Bearer {config['api_key']}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        if resp.status_code != 200:
            logger.error("LLM API 错误 {}: {}", resp.status_code, resp.text)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"LLM API 错误: {resp.status_code}",
            )
        data = resp.json()
        return data.get("choices", [{}])[0].get("message", {}).get("content", "")


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
        result = await _llm_chat(messages, temperature=0.5, max_tokens=512)
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
        result = await _llm_chat(messages, temperature=0.6, max_tokens=800)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"未知 action: {request.action}",
        )

    return AISummaryResponse(data=result)
