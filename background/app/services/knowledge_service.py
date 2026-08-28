# -*- coding: utf-8 -*-
"""知识库服务：知识库的 CRUD 操作和搜索。"""

from __future__ import annotations

from typing import List, Optional

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import Knowledge, User
from app.infrastructure.database.session import get_async_session
from app.models.schemas import KnowledgeCreate, KnowledgeUpdate, KnowledgeResponse


async def get_user_knowledge_bases(user_id: str) -> List[KnowledgeResponse]:
    """获取用户的所有知识库。"""
    async for session in get_async_session():
        result = await session.execute(
            select(Knowledge)
            .where(Knowledge.user_id == user_id)
            .order_by(Knowledge.created_at.desc())
        )
        knowledge_bases = result.scalars().all()
        return [
            KnowledgeResponse(
                id=kb.id,
                name=kb.name,
                description=kb.description,
                status=kb.status,
                created_at=kb.created_at.isoformat(),
                updated_at=kb.updated_at.isoformat(),
            )
            for kb in knowledge_bases
        ]


async def create_knowledge_base(user_id: str, kb_data: KnowledgeCreate) -> KnowledgeResponse:
    """创建新知识库。"""
    async for session in get_async_session():
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
    async for session in get_async_session():
        result = await session.execute(
            select(Knowledge).where(
                and_(Knowledge.id == kb_id, Knowledge.user_id == user_id)
            )
        )
        knowledge = result.scalar_one_or_none()
        if not knowledge:
            return None

        return KnowledgeResponse(
            id=knowledge.id,
            name=knowledge.name,
            description=knowledge.description,
            status=knowledge.status,
            created_at=knowledge.created_at.isoformat(),
            updated_at=knowledge.updated_at.isoformat(),
        )


async def update_knowledge_base(
    kb_id: str, user_id: str, kb_data: KnowledgeUpdate
) -> Optional[KnowledgeResponse]:
    """更新知识库。"""
    async for session in get_async_session():
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

        return KnowledgeResponse(
            id=knowledge.id,
            name=knowledge.name,
            description=knowledge.description,
            status=knowledge.status,
            created_at=knowledge.created_at.isoformat(),
            updated_at=knowledge.updated_at.isoformat(),
        )


async def delete_knowledge_base(kb_id: str, user_id: str) -> bool:
    """删除知识库。"""
    async for session in get_async_session():
        result = await session.execute(
            select(Knowledge).where(
                and_(Knowledge.id == kb_id, Knowledge.user_id == user_id)
            )
        )
        knowledge = result.scalar_one_or_none()
        if not knowledge:
            return False

        await session.delete(knowledge)
        await session.commit()
        return True


async def search_knowledge_bases(user_id: str, query: str) -> List[KnowledgeResponse]:
    """搜索知识库。"""
    async for session in get_async_session():
        result = await session.execute(
            select(Knowledge).where(
                and_(
                    Knowledge.user_id == user_id,
                    Knowledge.name.ilike(f"%{query}%"),
                )
            ).order_by(Knowledge.created_at.desc())
        )
        knowledge_bases = result.scalars().all()
        return [
            KnowledgeResponse(
                id=kb.id,
                name=kb.name,
                description=kb.description,
                status=kb.status,
                created_at=kb.created_at.isoformat(),
                updated_at=kb.updated_at.isoformat(),
            )
            for kb in knowledge_bases
        ]