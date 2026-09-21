# -*- coding: utf-8 -*-
"""文档服务：文档的上传、列表、详情、删除。"""

from __future__ import annotations

import asyncio
import uuid
from pathlib import Path
from typing import List, Optional

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.etl import ETLPipeline
from app.infrastructure.database.models import Document, Chunk, Knowledge
from app.infrastructure.database.session import get_async_session, get_session_context
from app.services.retrieval_service import retrieval_service
from app.models.schemas import (
    DocumentCreate,
    DocumentResponse,
    DocumentUploadResponse,
)


async def upload_document(
    knowledge_id: str,
    file_data: bytes,
    filename: str,
    mime_type: str,
    user_id: str,
) -> DocumentUploadResponse:
    """上传文档并执行 ETL 分块。"""
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

        # 保存文件
        upload_root = Path("uploads")
        upload_root.mkdir(parents=True, exist_ok=True)

        doc_id = str(uuid.uuid4())
        safe_name = Path((filename or "unnamed").replace("\\", "/")).name
        dest = upload_root / f"{doc_id}_{safe_name}"

        try:
            await asyncio.to_thread(dest.write_bytes, file_data)
        except Exception as exc:
            raise RuntimeError(f"保存文件失败: {exc}")

        # 执行 ETL
        pipeline = ETLPipeline()
        try:
            etl = await pipeline.run_bytes(
                file_data,
                filename=safe_name,
                mime_type=mime_type,
            )
            if not etl.chunks or not any(chunk.strip() for chunk in etl.chunks):
                raise ValueError("文档没有可提取的文本，请检查内容或先进行 OCR 识别")
        except Exception as exc:
            await asyncio.to_thread(dest.unlink, missing_ok=True)
            raise RuntimeError(f"文档解析失败: {exc}") from exc

        # 创建文档记录
        document = Document(
            id=doc_id,
            knowledge_id=knowledge_id,
            filename=safe_name,
            filepath=str(dest),
            mime_type=mime_type,
            size=len(file_data),
            parse_status="completed",
            chunk_count=len(etl.chunks),
            char_count=sum(len(chunk) for chunk in etl.chunks),
        )
        session.add(document)

        # 创建分块记录
        for i, chunk_text in enumerate(etl.chunks):
            chunk = Chunk(
                id=str(uuid.uuid4()),
                document_id=doc_id,
                chunk_index=i,
                content=chunk_text[:65000],
                token_count=len(chunk_text.split()),
            )
            session.add(chunk)

        await session.commit()
        indexed = await retrieval_service.sync_knowledge(knowledge_id, user_id)

        return DocumentUploadResponse(
            id=doc_id,
            filename=safe_name,
            status="completed",
            index_status="indexed" if indexed else "keyword_only",
            chunk_count=len(etl.chunks),
            message="上传并索引成功" if indexed else "上传成功，暂使用关键词检索；向量索引将在下次检索时重试",
        )


async def get_documents_by_knowledge(knowledge_id: str, user_id: str) -> List[DocumentResponse]:
    """获取知识库的文档列表。"""
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

        # 获取文档列表
        result = await session.execute(
            select(Document)
            .where(Document.knowledge_id == knowledge_id)
            .order_by(Document.created_at.desc())
        )
        documents = result.scalars().all()

        return [
            DocumentResponse(
                id=doc.id,
                knowledge_id=doc.knowledge_id,
                filename=doc.filename,
                mime_type=doc.mime_type,
                size=doc.size,
                parse_status="completed" if doc.parse_status == "ready" else doc.parse_status,
                index_status=retrieval_service.document_index_status(doc.id),
                chunk_count=doc.chunk_count,
                char_count=doc.char_count,
                enabled=doc.enabled,
                created_at=doc.created_at.isoformat(),
                updated_at=doc.updated_at.isoformat(),
            )
            for doc in documents
        ]


async def get_document(document_id: str, user_id: str) -> Optional[DocumentResponse]:
    """获取文档详情。"""
    async with get_session_context() as session:
        result = await session.execute(
            select(Document).where(Document.id == document_id)
        )
        document = result.scalar_one_or_none()
        if not document:
            return None

        # 检查文档是否属于当前用户的知识库
        kb_result = await session.execute(
            select(Knowledge).where(
                and_(
                    Knowledge.id == document.knowledge_id,
                    Knowledge.user_id == user_id,
                )
            )
        )
        knowledge = kb_result.scalar_one_or_none()
        if not knowledge:
            return None

        chunks = (await session.scalars(select(Chunk).where(
            Chunk.document_id == document_id
        ).order_by(Chunk.chunk_index))).all()
        return DocumentResponse(
            id=document.id,
            knowledge_id=document.knowledge_id,
            filename=document.filename,
            mime_type=document.mime_type,
            size=document.size,
            parse_status="completed" if document.parse_status == "ready" else document.parse_status,
            index_status=retrieval_service.document_index_status(document.id),
            chunk_count=document.chunk_count,
            char_count=document.char_count,
            enabled=document.enabled,
            created_at=document.created_at.isoformat(),
            updated_at=document.updated_at.isoformat(),
            chunks=[dict(id=c.id, document_id=c.document_id, chunk_index=c.chunk_index,
                         content=c.content, token_count=c.token_count,
                         created_at=c.created_at.isoformat()) for c in chunks],
        )


async def update_document_enabled(document_id: str, user_id: str, enabled: bool) -> Optional[DocumentResponse]:
    async with get_session_context() as session:
        document = await session.scalar(select(Document).join(Knowledge).where(
            Document.id == document_id, Knowledge.user_id == user_id
        ))
        if document is None:
            return None
        document.enabled = enabled
        await session.commit()
    await retrieval_service.sync_knowledge(document.knowledge_id, user_id)
    return await get_document(document_id, user_id)


async def delete_document(document_id: str, user_id: str) -> bool:
    """删除文档。"""
    async with get_session_context() as session:
        result = await session.execute(
            select(Document).where(Document.id == document_id)
        )
        document = result.scalar_one_or_none()
        if not document:
            return False

        # 检查文档是否属于当前用户的知识库
        kb_result = await session.execute(
            select(Knowledge).where(
                and_(
                    Knowledge.id == document.knowledge_id,
                    Knowledge.user_id == user_id,
                )
            )
        )
        knowledge = kb_result.scalar_one_or_none()
        if not knowledge:
            return False

        # 删除文件
        try:
            file_path = Path(document.filepath)
            if file_path.exists():
                await asyncio.to_thread(file_path.unlink)
        except Exception as exc:
            logger.warning("删除文件失败: {}", exc)

        # 删除文档记录（级联删除分块）
        await session.delete(document)
        await session.commit()
        await retrieval_service.sync_knowledge(document.knowledge_id, user_id)
        return True
