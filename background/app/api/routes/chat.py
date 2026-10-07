# -*- coding: utf-8 -*-
"""聊天 API：RAG 聊天（SSE 流式）。"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from loguru import logger

from app.api.routes.auth import get_current_user_dependency
from app.models.schemas import ChatRequest, UserResponse
from app.services.chat_service import chat_service

router = APIRouter(tags=["chat"])


@router.post("/chat")
async def chat_endpoint(
    request: ChatRequest,
    current_user: UserResponse = Depends(get_current_user_dependency),
) -> StreamingResponse:
    """RAG 聊天（SSE 流式响应）。"""
    try:
        # 验证请求参数
        if not request.conversation_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="conversationId 不能为空",
            )
        if not request.question or len(request.question.strip()) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="问题不能为空",
            )
        if len(request.question) > 2000:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="问题过长",
            )
        if request.mode not in ["question", "interview"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="mode 不合法",
            )
        if request.mode == "interview":
            raise HTTPException(status_code=409, detail="请使用模拟面试面板开始或继续面试")

        # 处理聊天请求
        return await chat_service.handle_chat(
            conversation_id=request.conversation_id,
            question=request.question.strip(),
            user_id=current_user.id,
            enable_search=request.enable_search,
            mode=request.mode,
            request_id=str(request.request_id) if request.request_id else None,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("聊天请求失败: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="聊天请求失败",
        )
