# -*- coding: utf-8 -*-
"""聊天服务：集成 RAG 系统的聊天功能。"""

from __future__ import annotations

import json
import uuid
from typing import AsyncIterator, Optional

from fastapi.responses import StreamingResponse
from loguru import logger

from app.core.rag.retriever import MultiRetriever
from app.core.rag.generator import RAGGenerator
from app.core.rag.reranker import Reranker
from app.infrastructure.database.models import Conversation, Message, Knowledge
from app.infrastructure.database.session import get_async_session
from app.models.schemas import (
    ChatRequest,
    ChatResponse,
    RAGResponse,
)
from sqlalchemy import select, and_


class ChatService:
    """聊天服务：集成 RAG 系统。"""

    def __init__(self):
        self.retriever = None
        self.generator = None
        self.reranker = None

    async def initialize(self):
        """初始化 RAG 组件。"""
        # 这里应该从配置中获取 Milvus 客户端和嵌入模型
        # 暂时使用占位实现
        pass

    async def handle_chat(
        self,
        conversation_id: str,
        question: str,
        user_id: str,
        enable_search: bool = False,
        mode: str = "question",
    ) -> StreamingResponse:
        """处理聊天请求，返回 SSE 流式响应。"""

        async def event_generator():
            try:
                # 1. 验证对话存在且属于用户
                async for session in get_async_session():
                    conv_result = await session.execute(
                        select(Conversation).where(Conversation.id == conversation_id)
                    )
                    conversation = conv_result.scalar_one_or_none()
                    if not conversation:
                        yield self._create_error_event("对话不存在")
                        return

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
                        yield self._create_error_event("对话不存在")
                        return

                # 2. 保存用户消息
                user_message = await self._save_message(
                    conversation_id, "user", question
                )

                # 3. 检索相关文档（如果启用搜索）
                contexts = []
                if enable_search:
                    contexts = await self._retrieve_contexts(question, knowledge.id)

                # 4. 生成回答
                answer = await self._generate_answer(
                    question, contexts, mode
                )

                # 5. 保存助手消息
                assistant_message = await self._save_message(
                    conversation_id, "assistant", answer
                )

                # 6. 发送响应
                yield self._create_data_event({
                    "content": answer,
                    "message_id": assistant_message.id,
                    "conversation_id": conversation_id,
                })

                yield self._create_done_event()

            except Exception as e:
                logger.exception("聊天处理失败: {}", e)
                yield self._create_error_event(f"聊天处理失败: {str(e)}")

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    async def _save_message(
        self, conversation_id: str, role: str, content: str
    ) -> Message:
        """保存消息到数据库。"""
        async for session in get_async_session():
            message = Message(
                id=str(uuid.uuid4()),
                conversation_id=conversation_id,
                role=role,
                content=content,
                citations="[]",
            )
            session.add(message)

            # 更新对话的消息计数
            conv_result = await session.execute(
                select(Conversation).where(Conversation.id == conversation_id)
            )
            conversation = conv_result.scalar_one_or_none()
            if conversation:
                conversation.message_count += 1

            await session.commit()
            await session.refresh(message)
            return message

    async def _retrieve_contexts(
        self, query: str, knowledge_id: str
    ) -> list[dict]:
        """检索相关文档上下文。"""
        # 这里应该调用实际的检索器
        # 暂时返回空列表
        return []

    async def _generate_answer(
        self,
        question: str,
        contexts: list[dict],
        mode: str,
    ) -> str:
        """生成回答。"""
        # 这里应该调用实际的生成器
        # 暂时返回模拟回答
        if mode == "interview":
            return f"这是关于 '{question}' 的模拟面试回答。"
        else:
            return f"这是关于 '{question}' 的回答。"

    def _create_data_event(self, data: dict) -> bytes:
        """创建 SSE 数据事件。"""
        return f"data: {json.dumps(data, ensure_ascii=False)}\n\n".encode("utf-8")

    def _create_error_event(self, error: str) -> bytes:
        """创建 SSE 错误事件。"""
        return f"data: {json.dumps({'error': error}, ensure_ascii=False)}\n\n".encode("utf-8")

    def _create_done_event(self) -> bytes:
        """创建 SSE 完成事件。"""
        return b"data: [DONE]\n\n"


# 全局聊天服务实例
chat_service = ChatService()