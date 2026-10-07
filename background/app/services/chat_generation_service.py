"""Claim a chat turn once and persist partial answers with a recoverable lease."""

import json
import uuid
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import select

from app.infrastructure.database.models import Conversation, Knowledge, Message, _utcnow
from app.infrastructure.database.session import get_session_context
from app.services.conversation_service import _load_citations


class GenerationConflict(ValueError):
    pass


@dataclass
class GenerationClaim:
    knowledge_id: str
    assistant_id: str
    request_id: str
    token: str | None
    history: list[Message]
    answer: str = ''
    citations: list | None = None


async def claim_generation(conversation_id, user_id, question, request_id, enable_search, timeout):
    async with get_session_context() as session:
        conversation = await session.scalar(select(Conversation).join(Knowledge).where(
            Conversation.id == conversation_id, Knowledge.user_id == user_id,
        ).with_for_update())
        if conversation is None:
            raise ValueError('对话不存在或无权访问该对话')
        messages = list((await session.scalars(select(Message).where(
            Message.conversation_id == conversation_id,
        ).order_by(Message.created_at, Message.message_index, Message.id))).all())
        assistant = next((m for m in messages if m.request_id == request_id and m.role == 'assistant'), None)
        options = {'enable_search': enable_search}
        if assistant is not None:
            user = next((m for m in messages if m.request_id == request_id and m.role == 'user'), None)
            if user is None or user.content != question or assistant.generation_options != options:
                raise GenerationConflict('同一请求标识不能用于不同的问题或检索设置')
            if assistant.generation_status == 'completed':
                return GenerationClaim(conversation.knowledge_id, assistant.id, request_id, None, [],
                                       assistant.content, _load_citations(assistant.citations))
        now = _utcnow()
        if any(m.role == 'assistant' and m.generation_status == 'generating'
               and m.generation_expires_at and m.generation_expires_at > now for m in messages):
            raise GenerationConflict('当前对话正在生成回答，请稍后刷新或重试')
        if assistant is None:
            session.add(Message(id=str(uuid.uuid4()), conversation_id=conversation_id, role='user',
                                content=question, request_id=request_id,
                                message_index=conversation.message_count + 1))
            assistant = Message(id=str(uuid.uuid4()), conversation_id=conversation_id, role='assistant',
                                content='', request_id=request_id, generation_options=options,
                                message_index=conversation.message_count + 2)
            session.add(assistant)
            conversation.message_count += 2
        token = str(uuid.uuid4())
        assistant.generation_status = 'generating'
        assistant.generation_error = None
        assistant.generation_token = token
        assistant.generation_expires_at = now + timedelta(seconds=timeout + 30)
        history = [m for m in messages if m.request_id != request_id]
        await session.commit()
        return GenerationClaim(conversation.knowledge_id, assistant.id, request_id, token, history)


async def persist_generation(claim, content=None, citations=None, status='generating', error=None):
    async with get_session_context() as session:
        message = await session.scalar(select(Message).where(
            Message.id == claim.assistant_id, Message.generation_token == claim.token,
            Message.generation_status == 'generating',
        ).with_for_update())
        if message is None:
            return False
        if content is not None:
            message.content = content
        if citations is not None:
            message.citations = json.dumps(citations, ensure_ascii=False)
        message.generation_status = status
        message.generation_error = error
        if status != 'generating':
            message.generation_token = None
            message.generation_expires_at = None
        await session.commit()
        return True
