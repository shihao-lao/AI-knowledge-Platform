# -*- coding: utf-8 -*-
"""对话服务：对话的 CRUD 操作和消息管理。"""

from __future__ import annotations

import json
from typing import Any, List, Optional

from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import Conversation, Message, Knowledge, _utcnow
from app.infrastructure.database.session import get_async_session, get_session_context
from app.models.enums import MessageRole
from app.models.schemas import (
    ConversationCreate,
    ConversationResponse,
    ConversationUpdate,
    MessageResponse,
)


def _load_citations(raw: Any) -> List[dict]:
    """把存储层里的引用解析为列表。

    数据库中 citations 是一段 JSON 文本（历史数据可能为空、非法或非数组），
    这里统一归一化为列表，避免把字符串直接透传给前端。
    """
    if isinstance(raw, list):
        return [item for item in raw if isinstance(item, dict)]
    if not raw:
        return []
    if isinstance(raw, (bytes, bytearray)):
        raw = raw.decode("utf-8", errors="ignore")
    if not isinstance(raw, str):
        return []
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        return []
    if not isinstance(parsed, list):
        return []
    return [item for item in parsed if isinstance(item, dict)]


async def get_conversations_by_knowledge(
    knowledge_id: str, user_id: str
) -> List[ConversationResponse]:
    """获取知识库的对话列表。"""
    async with get_session_context() as session:
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
                knowledge_id=conv.knowledge_id,
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
    async with get_session_context() as session:
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
        await session.flush()
        # 欢迎语由服务端生成，与对话在同一事务中保存。
        session.add(Message(
            conversation_id=conversation.id,
            role=MessageRole.ASSISTANT,
            content=(
                f"你好，我已准备好基于「{knowledge.name}」中的资料回答问题。"
                "开始输入你的问题吧，我会尽量附上可验证的引用来源。"
            ),
            citations="[]",
            message_index=1,
        ))
        conversation.message_count = 1
        await session.commit()
        await session.refresh(conversation)

        return ConversationResponse(
            id=conversation.id,
            knowledge_id=conversation.knowledge_id,
            title=conversation.title,
            message_count=conversation.message_count,
            created_at=conversation.created_at.isoformat(),
            updated_at=conversation.updated_at.isoformat(),
        )


async def get_conversation(conversation_id: str, user_id: str) -> Optional[ConversationResponse]:
    """获取对话详情。"""
    async with get_session_context() as session:
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
            knowledge_id=conversation.knowledge_id,
            title=conversation.title,
            message_count=conversation.message_count,
            created_at=conversation.created_at.isoformat(),
            updated_at=conversation.updated_at.isoformat(),
        )


async def delete_conversation(conversation_id: str, user_id: str) -> bool:
    """删除对话。"""
    async with get_session_context() as session:
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
    async with get_session_context() as session:
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
            .order_by(Message.created_at, Message.message_index, Message.id)
        )
        messages = result.scalars().all()
        questions = {m.request_id: m.content for m in messages if m.role == 'user' and m.request_id}

        def display_status(msg):
            if msg.generation_status == 'generating' and msg.generation_expires_at and msg.generation_expires_at <= _utcnow():
                return 'interrupted'
            return msg.generation_status

        return [
            MessageResponse(
                id=msg.id,
                role=msg.role,
                content=msg.content,
                citations=_load_citations(msg.citations),
                created_at=msg.created_at.isoformat(),
                request_id=msg.request_id,
                generation_status=display_status(msg),
                error=(msg.generation_error or '回答中断，可以重试此问题')
                    if display_status(msg) in {'failed', 'interrupted'} else None,
                retry_question=questions.get(msg.request_id)
                    if msg.role == 'assistant' and display_status(msg) in {'failed', 'interrupted'} else None,
            )
            for msg in messages
        ]


async def add_message_to_conversation(
    conversation_id: str,
    user_id: str,
    role: MessageRole,
    content: str,
) -> MessageResponse:
    """向当前用户的对话添加用户消息；其他角色只能由后端生成。"""
    if role != MessageRole.USER:
        raise PermissionError("客户端只能提交用户消息")

    async with get_session_context() as session:
        # 服务层校验对话 → 知识库 → 用户，避免其他调用者绕过路由检查。
        conv_result = await session.execute(
            select(Conversation)
            .join(Knowledge, Conversation.knowledge_id == Knowledge.id)
            .where(Conversation.id == conversation_id, Knowledge.user_id == user_id)
            .with_for_update()
        )
        conversation = conv_result.scalar_one_or_none()
        if not conversation:
            raise ValueError("对话不存在")

        # 创建消息
        message = Message(
            conversation_id=conversation_id,
            role=MessageRole.USER,
            content=content,
            citations="[]",
            message_index=conversation.message_count + 1,
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
            citations=_load_citations(message.citations),
            created_at=message.created_at.isoformat(),
        )


async def update_conversation(
    conversation_id: str,
    user_id: str,
    conv_data: ConversationUpdate,
) -> Optional[ConversationResponse]:
    """更新当前用户的对话标题。"""
    async with get_session_context() as session:
        result = await session.execute(
            select(Conversation)
            .join(Knowledge, Conversation.knowledge_id == Knowledge.id)
            .where(
                and_(
                    Conversation.id == conversation_id,
                    Knowledge.user_id == user_id,
                )
            )
        )
        conversation = result.scalar_one_or_none()
        if not conversation:
            return None

        if conv_data.title is not None:
            conversation.title = conv_data.title
        await session.commit()
        await session.refresh(conversation)

        return ConversationResponse(
            id=conversation.id,
            knowledge_id=conversation.knowledge_id,
            title=conversation.title,
            message_count=conversation.message_count,
            created_at=conversation.created_at.isoformat(),
            updated_at=conversation.updated_at.isoformat(),
        )
