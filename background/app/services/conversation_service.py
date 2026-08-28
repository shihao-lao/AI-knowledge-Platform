# -*- coding: utf-8 -*-
"""对话服务：对话的 CRUD 操作和消息管理。"""

from __future__ import annotations

from typing import List, Optional

from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import Conversation, Message, Knowledge
from app.infrastructure.database.session import get_async_session
from app.models.schemas import (
    ConversationCreate,
    ConversationResponse,
    MessageResponse,
)


async def get_conversations_by_knowledge(
    knowledge_id: str, user_id: str
) -> List[ConversationResponse]:
    """获取知识库的对话列表。"""
    async for session in get_async_session():
        # 检查知识库是否存在且属于当前用户
        kb_result = await session.execute(
            select(Knowledge).where(
                and_(Knowledge.id == knowledge_id, Knowledge.user_id == user_id)
            )
        )
        knowledge = kb_result.scalar_one_or_none()
        if not knowledge:
            raise ValueError("知识库不存在")

        # 获取对话列表
        result = await session.execute(
            select(Conversation)
            .where(Conversation.knowledge_id == knowledge_id)
            .order_by(Conversation.updated_at.desc())
        )
        conversations = result.scalars().all()

        return [
            ConversationResponse(
                id=conv.id,
                title=conv.title,
                message_count=conv.message_count,
                created_at=conv.created_at.isoformat(),
                updated_at=conv.updated_at.isoformat(),
            )
            for conv in conversations
        ]


async def create_conversation(
    knowledge_id: str, user_id: str, conv_data: ConversationCreate
) -> ConversationResponse:
    """创建新对话。"""
    async for session in get_async_session():
        # 检查知识库是否存在且属于当前用户
        kb_result = await session.execute(
            select(Knowledge).where(
                and_(Knowledge.id == knowledge_id, Knowledge.user_id == user_id)
            )
        )
        knowledge = kb_result.scalar_one_or_none()
        if not knowledge:
            raise ValueError("知识库不存在")

        # 创建对话
        conversation = Conversation(
            knowledge_id=knowledge_id,
            title=conv_data.title or "新对话",
        )
        session.add(conversation)
        await session.commit()
        await session.refresh(conversation)

        return ConversationResponse(
            id=conversation.id,
            title=conversation.title,
            message_count=conversation.message_count,
            created_at=conversation.created_at.isoformat(),
            updated_at=conversation.updated_at.isoformat(),
        )


async def get_conversation(conversation_id: str, user_id: str) -> Optional[ConversationResponse]:
    """获取对话详情。"""
    async for session in get_async_session():
        result = await session.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        conversation = result.scalar_one_or_none()
        if not conversation:
            return None

        # 检查对话是否属于当前用户的知识库
        kb_result = await session.execute(
            select(Knowledge).where(
                and_(
                    Knowledge.id == conversation.knowledge_id,
                    Knowledge.user_id == user_id,
                )
            )
        )
        knowledge = kb_result.scalar_one_or_none()
        if not knowledge:
            return None

        return ConversationResponse(
            id=conversation.id,
            title=conversation.title,
            message_count=conversation.message_count,
            created_at=conversation.created_at.isoformat(),
            updated_at=conversation.updated_at.isoformat(),
        )


async def delete_conversation(conversation_id: str, user_id: str) -> bool:
    """删除对话。"""
    async for session in get_async_session():
        result = await session.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        conversation = result.scalar_one_or_none()
        if not conversation:
            return False

        # 检查对话是否属于当前用户的知识库
        kb_result = await session.execute(
            select(Knowledge).where(
                and_(
                    Knowledge.id == conversation.knowledge_id,
                    Knowledge.user_id == user_id,
                )
            )
        )
        knowledge = kb_result.scalar_one_or_none()
        if not knowledge:
            return False

        # 删除对话（级联删除消息）
        await session.delete(conversation)
        await session.commit()
        return True


async def get_messages_by_conversation(
    conversation_id: str, user_id: str
) -> List[MessageResponse]:
    """获取对话的消息列表。"""
    async for session in get_async_session():
        # 检查对话是否存在且属于当前用户
        conv_result = await session.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        conversation = conv_result.scalar_one_or_none()
        if not conversation:
            raise ValueError("对话不存在")

        # 检查对话是否属于当前用户的知识库
        kb_result = await session.execute(
            select(Knowledge).where(
                and_(
                    Knowledge.id == conversation.knowledge_id,
                    Knowledge.user_id == user_id,
                )
            )
        )
        knowledge = kb_result.scalar_one_or_none()
        if not knowledge:
            raise ValueError("对话不存在")

        # 获取消息列表
        result = await session.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.asc())
        )
        messages = result.scalars().all()

        return [
            MessageResponse(
                id=msg.id,
                role=msg.role,
                content=msg.content,
                citations=msg.citations,
                created_at=msg.created_at.isoformat(),
            )
            for msg in messages
        ]


async def add_message_to_conversation(
    conversation_id: str,
    role: str,
    content: str,
    citations: str = "[]",
) -> MessageResponse:
    """向对话添加消息。"""
    async for session in get_async_session():
        # 检查对话是否存在
        conv_result = await session.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        conversation = conv_result.scalar_one_or_none()
        if not conversation:
            raise ValueError("对话不存在")

        # 创建消息
        message = Message(
            conversation_id=conversation_id,
            role=role,
            content=content,
            citations=citations,
        )
        session.add(message)

        # 更新对话的消息计数
        conversation.message_count += 1
        await session.commit()
        await session.refresh(message)

        return MessageResponse(
            id=message.id,
            role=message.role,
            content=message.content,
            citations=message.citations,
            created_at=message.created_at.isoformat(),
        )