# -*- coding: utf-8 -*-
"""知识库服务：知识库的 CRUD 操作和搜索。"""

from __future__ import annotations

from pathlib import Path
from typing import List, Optional

from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import Knowledge, User, Document, KnowledgeVectorIndex, ResourceCleanupTask
from app.infrastructure.database.session import get_async_session, get_session_context
from app.models.schemas import KnowledgeCreate, KnowledgeUpdate, KnowledgeResponse
from app.services.retrieval_service import retrieval_service
from app.services.resource_cleanup_service import run_cleanup_task
from loguru import logger


async def _document_counts(session: AsyncSession, kb_ids: list[str]) -> dict[str, int]:
    """按知识库统计文档数量，避免逐个知识库单独查询。"""
    if not kb_ids:
        return {}
    rows = await session.execute(
        select(Document.knowledge_id, func.count(Document.id))
        .where(Document.knowledge_id.in_(kb_ids))
        .group_by(Document.knowledge_id)
    )
    return {kb_id: count for kb_id, count in rows.all()}


async def get_user_knowledge_bases(user_id: str) -> List[KnowledgeResponse]:
    """获取用户的所有知识库。"""
    async with get_session_context() as session:
        result = await session.execute(
            select(Knowledge)
            .where(Knowledge.user_id == user_id)
            .order_by(Knowledge.created_at.desc())
        )
        knowledge_bases = result.scalars().all()
        counts = await _document_counts(session, [kb.id for kb in knowledge_bases])
        return [
            KnowledgeResponse(
                id=kb.id,
                name=kb.name,
                description=kb.description,
                status=kb.status,
                document_count=counts.get(kb.id, 0),
                created_at=kb.created_at.isoformat(),
                updated_at=kb.updated_at.isoformat(),
            )
            for kb in knowledge_bases
        ]


async def create_knowledge_base(user_id: str, kb_data: KnowledgeCreate) -> KnowledgeResponse:
    """创建新知识库。"""
    async with get_session_context() as session:
        # 检查用户是否存在
        user_result = await session.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()
        if not user:
            raise ValueError("用户不存在")

        # 创建知识库
        knowledge = Knowledge(
            user_id=user_id,
            name=kb_data.name,
            description=kb_data.description or "",
        )
        session.add(knowledge)
        await session.commit()
        await session.refresh(knowledge)

        return KnowledgeResponse(
            id=knowledge.id,
            name=knowledge.name,
            description=knowledge.description,
            status=knowledge.status,
            created_at=knowledge.created_at.isoformat(),
            updated_at=knowledge.updated_at.isoformat(),
        )


async def get_knowledge_base(kb_id: str, user_id: str) -> Optional[KnowledgeResponse]:
    """获取知识库详情。"""
    async with get_session_context() as session:
        result = await session.execute(
            select(Knowledge).where(
                and_(Knowledge.id == kb_id, Knowledge.user_id == user_id)
            )
        )
        knowledge = result.scalar_one_or_none()
        if not knowledge:
            return None

        counts = await _document_counts(session, [knowledge.id])
        return KnowledgeResponse(
            id=knowledge.id,
            name=knowledge.name,
            description=knowledge.description,
            status=knowledge.status,
            document_count=counts.get(knowledge.id, 0),
            created_at=knowledge.created_at.isoformat(),
            updated_at=knowledge.updated_at.isoformat(),
        )


async def update_knowledge_base(
    kb_id: str, user_id: str, kb_data: KnowledgeUpdate
) -> Optional[KnowledgeResponse]:
    """更新知识库。"""
    async with get_session_context() as session:
        result = await session.execute(
            select(Knowledge).where(
                and_(Knowledge.id == kb_id, Knowledge.user_id == user_id)
            )
        )
        knowledge = result.scalar_one_or_none()
        if not knowledge:
            return None

        # 更新字段
        if kb_data.name is not None:
            knowledge.name = kb_data.name
        if kb_data.description is not None:
            knowledge.description = kb_data.description

        await session.commit()
        await session.refresh(knowledge)

        counts = await _document_counts(session, [knowledge.id])
        return KnowledgeResponse(
            id=knowledge.id,
            name=knowledge.name,
            description=knowledge.description,
            status=knowledge.status,
            document_count=counts.get(knowledge.id, 0),
            created_at=knowledge.created_at.isoformat(),
            updated_at=knowledge.updated_at.isoformat(),
        )


async def delete_knowledge_base(kb_id: str, user_id: str) -> bool:
    """删除知识库。"""
    async with retrieval_service._locks[kb_id], get_session_context() as session:
        result = await session.execute(
            select(Knowledge).where(
                and_(Knowledge.id == kb_id, Knowledge.user_id == user_id)
            ).with_for_update()
        )
        knowledge = result.scalar_one_or_none()
        if not knowledge:
            return False

        documents = list((await session.scalars(select(Document).where(Document.knowledge_id == kb_id))).all())
        collections = set((await session.scalars(select(KnowledgeVectorIndex.collection_name).where(
            KnowledgeVectorIndex.knowledge_id == kb_id,
        ))).all())
        collections.add(retrieval_service._collection(kb_id))
        root = Path('uploads').resolve()
        files = []
        for document in documents:
            if not document.filepath:
                continue
            path = Path(document.filepath).resolve()
            if not path.is_relative_to(root):
                raise ValueError('上传文件路径不在 uploads 目录内')
            files.append(str(path))
        task = ResourceCleanupTask(knowledge_id=kb_id, files=files, collections=sorted(collections))
        session.add(task)
        await session.delete(knowledge)
        await session.commit()
        retrieval_service.forget_knowledge(kb_id, [document.id for document in documents], collections)
    retrieval_service._locks.pop(kb_id, None)
    try:
        await run_cleanup_task(task.id)
    except Exception as exc:
        logger.warning('知识库已删除，清理任务 {} 留待后台重试: {}', task.id, type(exc).__name__)
    return True


async def search_knowledge_bases(user_id: str, query: str) -> List[KnowledgeResponse]:
    """搜索知识库。"""
    async with get_session_context() as session:
        result = await session.execute(
            select(Knowledge).where(
                and_(
                    Knowledge.user_id == user_id,
                    Knowledge.name.ilike(f"%{query}%"),
                )
            ).order_by(Knowledge.created_at.desc())
        )
        knowledge_bases = result.scalars().all()
        counts = await _document_counts(session, [kb.id for kb in knowledge_bases])
        return [
            KnowledgeResponse(
                id=kb.id,
                name=kb.name,
                description=kb.description,
                status=kb.status,
                document_count=counts.get(kb.id, 0),
                created_at=kb.created_at.isoformat(),
                updated_at=kb.updated_at.isoformat(),
            )
            for kb in knowledge_bases
        ]
