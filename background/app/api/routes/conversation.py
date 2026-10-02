# -*- coding: utf-8 -*-
"""对话 API：对话的 CRUD 操作和消息管理。"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger

from app.api.routes.auth import get_current_user_dependency
from app.models.enums import MessageRole
from app.models.schemas import (
    ConversationCreate,
    ConversationResponse,
    ConversationUpdate,
    MessageResponse,
    UserResponse,
)
from app.services.conversation_service import (
    add_message_to_conversation,
    create_conversation,
    delete_conversation,
    get_conversation,
    get_conversations_by_knowledge,
    get_messages_by_conversation,
    update_conversation,
)

router = APIRouter(tags=["conversations"])


@router.get("/conversations", response_model=dict)
async def list_conversations(
    knowledge_id: str,
    current_user: UserResponse = Depends(get_current_user_dependency),
) -> dict:
    """获取知识库的对话列表。"""
    try:
        conversations = await get_conversations_by_knowledge(knowledge_id, current_user.id)
        return {"data": conversations}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.exception("获取对话列表失败: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取对话列表失败",
        )


@router.post("/conversations", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_conversation_endpoint(
    knowledge_id: str,
    conv_data: ConversationCreate,
    current_user: UserResponse = Depends(get_current_user_dependency),
) -> dict:
    """创建新对话。"""
    try:
        conversation = await create_conversation(knowledge_id, current_user.id, conv_data)
        logger.info("创建对话成功: {}", conversation.title)
        return {"data": conversation}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.exception("创建对话失败: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="创建对话失败",
        )


@router.get("/conversations/{conversation_id}", response_model=dict)
async def get_conversation_endpoint(
    conversation_id: str,
    current_user: UserResponse = Depends(get_current_user_dependency),
) -> dict:
    """获取对话详情。"""
    try:
        conversation = await get_conversation(conversation_id, current_user.id)
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="对话不存在",
            )
        return {"data": conversation}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("获取对话详情失败: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取对话详情失败",
        )


@router.delete("/conversations/{conversation_id}", response_model=dict)
async def delete_conversation_endpoint(
    conversation_id: str,
    current_user: UserResponse = Depends(get_current_user_dependency),
) -> dict:
    """删除对话。"""
    try:
        success = await delete_conversation(conversation_id, current_user.id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="对话不存在",
            )
        logger.info("删除对话成功: {}", conversation_id)
        return {"message": "删除成功"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("删除对话失败: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="删除对话失败",
        )


@router.put("/conversations/{conversation_id}", response_model=dict)
async def update_conversation_endpoint(
    conversation_id: str,
    conv_data: ConversationUpdate,
    current_user: UserResponse = Depends(get_current_user_dependency),
) -> dict:
    """更新当前用户的对话。"""
    try:
        conversation = await update_conversation(conversation_id, current_user.id, conv_data)
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="对话不存在",
            )
        return {"data": conversation}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("更新对话失败: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="更新对话失败",
        )


@router.get("/conversations/{conversation_id}/messages", response_model=dict)
async def get_messages_endpoint(
    conversation_id: str,
    current_user: UserResponse = Depends(get_current_user_dependency),
) -> dict:
    """获取对话的消息列表。"""
    try:
        messages = await get_messages_by_conversation(conversation_id, current_user.id)
        return {"data": messages}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.exception("获取消息列表失败: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取消息列表失败",
        )


@router.post("/conversations/{conversation_id}/messages", response_model=dict)
async def add_message_endpoint(
    conversation_id: str,
    role: MessageRole,
    content: str,
    current_user: UserResponse = Depends(get_current_user_dependency),
) -> dict:
    """向当前用户的对话添加用户消息；assistant/system 由后端生成。"""
    try:
        message = await add_message_to_conversation(
            conversation_id=conversation_id,
            user_id=current_user.id,
            role=role,
            content=content,
        )
        return {"data": message}
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        ) from e
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("添加消息失败: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="添加消息失败",
        )
