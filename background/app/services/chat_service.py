# -*- coding: utf-8 -*-
"""
聊天服务：基于 LangChain 实现 RAG 对话流水线。

流程：用户提问 → Milvus 与 BM25 检索并通过 RRF 融合 →
     LangChain 构建 Prompt → MiMo LLM 流式生成 → SSE 推送前端
"""

from __future__ import annotations

import asyncio
import json
import os
import time
import uuid

from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from loguru import logger

from app.services.retrieval_service import retrieval_service
from app.infrastructure.database.models import Message
from app.services.chat_generation_service import claim_generation, persist_generation
from app.infrastructure.llm.config import (
    NOT_CONFIGURED_HINT,
    build_chat_model,
    resolve_llm_config,
    describe_llm_error,
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

# ==================== 对话历史管理 ====================


def _get_chat_history(
    session_messages: list[Message], max_turns: int = 10
) -> list:
    """从数据库消息构建 LangChain 消息列表（滑动窗口）。"""
    history = []
    # 系统指令只由服务端 Prompt 提供，旧客户端写入的 system 消息不能进入历史。
    incomplete = {
        msg.request_id for msg in session_messages
        if getattr(msg, 'request_id', None) and msg.role == 'assistant'
        and getattr(msg, 'generation_status', 'completed') != 'completed'
    }
    dialogue = [msg for msg in session_messages if msg.role in {"user", "assistant"}
                and getattr(msg, 'request_id', None) not in incomplete]
    recent = dialogue[-max_turns * 2 :]

    for msg in recent:
        if msg.role == "user":
            history.append(HumanMessage(content=msg.content))
        elif msg.role == "assistant":
            history.append(AIMessage(content=msg.content))

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
        request_id: str | None = None,
    ) -> StreamingResponse:
        """处理聊天请求，返回 SSE 流式响应。"""
        if mode != "question":
            raise ValueError("模拟面试由 interview_service 管理，请使用面试接口")

        async def event_generator():
            claim = None
            full_answer = ''
            contexts = []
            timeout = max(1, int(os.getenv('CHAT_GENERATION_TIMEOUT', '180')))
            try:
                claim = await claim_generation(conversation_id, user_id, question,
                                               request_id or str(uuid.uuid4()), enable_search, timeout)
                yield f"data: {json.dumps({'type': 'request', 'requestId': claim.request_id})}\n\n".encode()
                if claim.token is None:
                    yield self._sse_delta(claim.answer)
                    if claim.citations:
                        yield self._sse_citations(claim.citations)
                    yield self._sse_done()
                    return

                async with asyncio.timeout(timeout):
                    llm_config = await resolve_llm_config(user_id)
                    if not llm_config.configured:
                        raise RuntimeError(NOT_CONFIGURED_HINT)
                    if enable_search:
                        contexts = await self._retrieve(question, claim.knowledge_id, user_id)
                    prompt = ChatPromptTemplate.from_messages([
                        ('system', QA_SYSTEM_PROMPT),
                        MessagesPlaceholder(variable_name='chat_history'),
                        ('human', '{question}'),
                    ])
                    chain = prompt | build_chat_model(llm_config, streaming=True) | StrOutputParser()
                    last_checkpoint = 0.0
                    async for chunk in chain.astream({
                        'context': _build_context_block(contexts),
                        'chat_history': _get_chat_history(claim.history), 'question': question,
                    }):
                        if not chunk:
                            continue
                        full_answer += chunk
                        if time.monotonic() - last_checkpoint >= 1:
                            if not await persist_generation(claim, full_answer, self._extract_citations(full_answer, contexts)):
                                raise RuntimeError('此回答已被重试或对话已删除，请刷新')
                            last_checkpoint = time.monotonic()
                        yield self._sse_delta(chunk)
                    if not full_answer.strip():
                        raise RuntimeError('模型返回了空回答，请重试')
                    citations = self._extract_citations(full_answer, contexts)
                    if not await persist_generation(claim, full_answer, citations, status='completed'):
                        raise RuntimeError('此回答已被重试或对话已删除，请刷新')
                if citations:
                    yield self._sse_citations(citations)
                yield self._sse_done()
            except (asyncio.CancelledError, GeneratorExit):
                if claim and claim.token:
                    await asyncio.shield(persist_generation(
                        claim, full_answer or None,
                        self._extract_citations(full_answer, contexts) if full_answer else None,
                        status='interrupted', error='回答中断，可以重试此问题',
                    ))
                raise
            except Exception as e:
                logger.exception("聊天处理失败: {}", e)
                error = '回答生成超时，请重试' if isinstance(e, TimeoutError) else describe_llm_error(e)
                if claim and claim.token:
                    try:
                        await persist_generation(
                            claim, full_answer or None,
                            self._extract_citations(full_answer, contexts) if full_answer else None,
                            status='failed', error=error,
                        )
                    except Exception as save_error:
                        logger.warning('保存中断状态失败，租约到期后可重试: {}', type(save_error).__name__)
                yield self._sse_error(error)

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
