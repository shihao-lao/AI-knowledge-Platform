# -*- coding: utf-8 -*-
"""
聊天服务：基于 LangChain 实现 RAG 对话流水线。

流程：用户提问 → Milvus 与 BM25 检索并通过 RRF 融合 →
     LangChain 构建 Prompt → MiMo LLM 流式生成 → SSE 推送前端
"""

from __future__ import annotations

import json
import uuid
from typing import Any

from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from loguru import logger
from sqlalchemy import and_, select

from app.services.retrieval_service import retrieval_service
from app.infrastructure.database.models import Conversation, Knowledge, Message
from app.infrastructure.database.session import get_session_context
from app.infrastructure.llm.config import (
    NOT_CONFIGURED_HINT,
    build_chat_model,
    resolve_llm_config,
)
from app.models.schemas import RetrievalResult


# ==================== LLM 初始化 ====================
# 配置解析统一走 app.infrastructure.llm.config，避免各处重复读环境变量：
# 用户级配置优先，服务端 .env 兜底。


# ==================== Prompt 模板 ====================

# 知识问答 Prompt
QA_SYSTEM_PROMPT = """你是一位严谨的 AI 知识助手。请根据以下检索到的参考资料回答用户问题。

要求：
1. 仅根据提供的参考资料作答，若资料不足请明确说明
2. 回答中引用来源时使用 [1]、[2] 等形式，与参考资料编号一致
3. 回答要准确、简洁、有条理
4. 如果参考资料中没有相关内容，不要编造

参考资料：
{context}"""

# 模拟面试 Prompt
INTERVIEW_SYSTEM_PROMPT = """你是一位资深的技术面试官。请根据以下参考资料和题库内容，对候选人的回答进行专业评估。

要求：
1. 逐题提问，等候选人回答后再给出评价
2. 评价包含：总分（0-100）、分项点评、遗漏要点、参考答案要点
3. 语气专业但友善，帮助候选人提升
4. 引用参考资料时使用 [1]、[2] 等标注

参考资料：
{context}"""


# ==================== 对话历史管理 ====================


def _get_chat_history(
    session_messages: list[Message], max_turns: int = 10
) -> list:
    """从数据库消息构建 LangChain 消息列表（滑动窗口）。"""
    history = []
    # 取最近 N 轮对话
    recent = session_messages[-max_turns * 2 :] if len(session_messages) > max_turns * 2 else session_messages

    for msg in recent:
        if msg.role == "user":
            history.append(HumanMessage(content=msg.content))
        elif msg.role == "assistant":
            history.append(AIMessage(content=msg.content))
        elif msg.role == "system":
            history.append(SystemMessage(content=msg.content))

    return history


def _build_context_block(results: list[RetrievalResult]) -> str:
    """将检索结果格式化为参考资料文本块。"""
    if not results:
        return "（无检索到相关资料）"

    lines = []
    for i, r in enumerate(results, start=1):
        lines.append(f"[{i}] {r.content}")
    return "\n\n".join(lines)


# ==================== 聊天服务 ====================


class ChatService:
    """聊天服务：基于 LangChain 的 RAG 对话。"""

    async def handle_chat(
        self,
        conversation_id: str,
        question: str,
        user_id: str,
        enable_search: bool = True,
        mode: str = "question",
    ) -> StreamingResponse:
        """处理聊天请求，返回 SSE 流式响应。"""

        async def event_generator():
            try:
                # ── 1. 验证对话归属 ──
                async with get_session_context() as session:
                    conv_result = await session.execute(
                        select(Conversation).where(Conversation.id == conversation_id)
                    )
                    conversation = conv_result.scalar_one_or_none()
                    if not conversation:
                        yield self._sse_error("对话不存在")
                        return

                    # 校验归属
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
                        yield self._sse_error("无权访问该对话")
                        return

                    # ── 2. 加载历史消息 ──
                    msg_result = await session.execute(
                        select(Message)
                        .where(Message.conversation_id == conversation_id)
                        .order_by(Message.created_at)
                    )
                    db_messages = list(msg_result.scalars().all())

                # ── 3. 保存用户消息 ──
                await self._save_message(conversation_id, "user", question)

                # ── 4. RAG 检索 ──
                contexts: list[RetrievalResult] = []
                if enable_search:
                    contexts = await self._retrieve(question, knowledge.id, user_id)
                    logger.info(
                        "检索完成: query='{}', 结果数={}",
                        question[:50],
                        len(contexts),
                    )

                # ── 5. 构建 LangChain Prompt ──
                context_block = _build_context_block(contexts)
                chat_history = _get_chat_history(db_messages)

                system_prompt = (
                    INTERVIEW_SYSTEM_PROMPT if mode == "interview" else QA_SYSTEM_PROMPT
                )

                prompt = ChatPromptTemplate.from_messages([
                    ("system", system_prompt),
                    MessagesPlaceholder(variable_name="chat_history"),
                    ("human", "{question}"),
                ])

                # ── 6. LangChain Chain: prompt | llm | parser ──
                llm_config = await resolve_llm_config(user_id)
                if not llm_config.configured:
                    yield self._sse_error(NOT_CONFIGURED_HINT)
                    return

                llm = build_chat_model(llm_config, streaming=True)
                chain = prompt | llm | StrOutputParser()

                # ── 7. 流式生成并推送 SSE ──
                full_answer = ""
                async for chunk in chain.astream(
                    {
                        "context": context_block,
                        "chat_history": chat_history,
                        "question": question,
                    }
                ):
                    full_answer += chunk
                    yield self._sse_delta(chunk)

                # ── 8. 提取引用 ──
                citations = self._extract_citations(full_answer, contexts)

                # ── 9. 保存助手消息 ──
                await self._save_message(
                    conversation_id,
                    "assistant",
                    full_answer,
                    citations=citations,
                )

                # ── 10. 推送引用信息 ──
                if citations:
                    yield self._sse_citations(citations)

                yield self._sse_done()

            except Exception as e:
                logger.exception("聊天处理失败: {}", e)
                yield self._sse_error(f"聊天处理失败: {str(e)}")

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    # ── 检索 ──

    async def _retrieve(self, query: str, knowledge_id: str, user_id: str) -> list[RetrievalResult]:
        return await retrieval_service.retrieve(query, knowledge_id, user_id)

    # ── 引用提取 ──

    def _extract_citations(
        self, answer: str, contexts: list[RetrievalResult]
    ) -> list[dict]:
        """从回答中解析 [n] 引用并映射到检索结果。"""
        import re

        refs = [int(x) for x in re.findall(r"\[(\d+)\]", answer)]
        citations = []
        seen: set[int] = set()
        for idx in refs:
            if idx in seen or idx < 1 or idx > len(contexts):
                continue
            seen.add(idx)
            r = contexts[idx - 1]
            if r.metadata.get("type") == "question":
                continue
            citations.append(
                {
                    "index": idx,
                    "documentId": r.metadata.get("document_id", r.id),
                    "documentTitle": r.metadata.get("filename", ""),
                    "chunkIndex": r.metadata.get("chunk_index", 0),
                    "preview": r.content[:200],
                    "confidenceScore": r.score,
                }
            )
        return citations

    # ── 数据库操作 ──

    async def _save_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        citations: list[dict] | None = None,
    ) -> None:
        """保存消息到数据库。"""
        async with get_session_context() as session:
            msg = Message(
                id=str(uuid.uuid4()),
                conversation_id=conversation_id,
                role=role,
                content=content,
                citations=json.dumps(citations or [], ensure_ascii=False),
            )
            session.add(msg)

            # 更新对话消息计数
            conv_result = await session.execute(
                select(Conversation).where(Conversation.id == conversation_id)
            )
            conversation = conv_result.scalar_one_or_none()
            if conversation:
                conversation.message_count += 1

            await session.commit()

    # ── SSE 事件格式 ──

    @staticmethod
    def _sse_delta(content: str) -> bytes:
        return f"data: {json.dumps({'type': 'delta', 'content': content}, ensure_ascii=False)}\n\n".encode()

    @staticmethod
    def _sse_citations(citations: list[dict]) -> bytes:
        return f"data: {json.dumps({'type': 'citations', 'citations': citations}, ensure_ascii=False)}\n\n".encode()

    @staticmethod
    def _sse_error(error: str) -> bytes:
        return f"data: {json.dumps({'type': 'error', 'message': error}, ensure_ascii=False)}\n\n".encode()

    @staticmethod
    def _sse_done() -> bytes:
        return b"data: [DONE]\n\n"


# 全局实例
chat_service = ChatService()
