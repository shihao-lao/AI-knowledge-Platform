# -*- coding: utf-8 -*-
"""题库服务：题目的导入、列表、详情、删除。"""

from __future__ import annotations

import json
from typing import List, Optional

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import Question, Knowledge, _utcnow
from app.infrastructure.database.session import get_async_session, get_session_context
from app.services.retrieval_service import retrieval_service
from app.models.schemas import (
    QuestionCreate,
    QuestionResponse,
    QuestionImportRequest,
    QuestionImportResponse,
)


async def get_questions_by_knowledge(
    knowledge_id: str,
    user_id: str,
    category: Optional[str] = None,
    difficulty: Optional[str] = None,
    keyword: Optional[str] = None,
) -> List[QuestionResponse]:
    """获取知识库的题目列表。"""
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

        # 构建查询
        query = select(Question).where(
            Question.knowledge_id == knowledge_id, Question.deleted_at.is_(None),
        )

        if category:
            query = query.where(Question.category == category)
        if difficulty:
            query = query.where(Question.difficulty == difficulty)
        if keyword:
            query = query.where(Question.question.ilike(f"%{keyword}%"))

        query = query.order_by(Question.created_at.desc())

        result = await session.execute(query)
        questions = result.scalars().all()

        return [
            QuestionResponse(
                id=q.id,
                category=q.category,
                difficulty=q.difficulty,
                question=q.question,
                answer=q.answer,
                keywords=json.loads(q.keywords) if q.keywords else [],
                source=q.source,
                created_at=q.created_at.isoformat(),
                updated_at=q.updated_at.isoformat(),
            )
            for q in questions
        ]


async def get_question_categories(knowledge_id: str, user_id: str) -> List[str]:
    """获取知识库的题目分类。"""
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

        # 获取分类
        result = await session.execute(
            select(Question.category)
            .where(Question.knowledge_id == knowledge_id, Question.deleted_at.is_(None))
            .distinct()
        )
        categories = result.scalars().all()
        return list(categories)


async def import_questions(
    knowledge_id: str,
    user_id: str,
    import_data: QuestionImportRequest,
) -> QuestionImportResponse:
    """导入题目。"""
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

        imported_count = 0
        skipped_count = 0
        errors = []

        for i, question_data in enumerate(import_data.questions):
            try:
                # 检查题目是否已存在（根据问题内容）
                existing_result = await session.execute(
                    select(Question).where(
                        and_(
                            Question.knowledge_id == knowledge_id,
                            Question.question == question_data.question,
                            Question.deleted_at.is_(None),
                        )
                    )
                )
                existing = existing_result.scalar_one_or_none()

                if existing:
                    skipped_count += 1
                    continue

                # 创建题目
                question = Question(
                    knowledge_id=knowledge_id,
                    category=question_data.category or "未分类",
                    difficulty=question_data.difficulty or "medium",
                    question=question_data.question,
                    answer=question_data.answer,
                    keywords=json.dumps(question_data.keywords or []),
                    source=question_data.source,
                )
                session.add(question)
                imported_count += 1

            except Exception as e:
                errors.append(f"第 {i + 1} 题导入失败: {str(e)}")

        await session.commit()
        indexed = await retrieval_service.sync_knowledge(knowledge_id, user_id)

        return QuestionImportResponse(
            imported=imported_count,
            skipped=skipped_count,
            errors=errors,
            message=f"成功导入 {imported_count} 题，跳过 {skipped_count} 题" + ("" if indexed else "；暂使用关键词检索，向量索引稍后重试"),
        )


async def get_question(question_id: str, user_id: str) -> Optional[QuestionResponse]:
    """获取题目详情。"""
    async with get_session_context() as session:
        result = await session.execute(
            select(Question).where(Question.id == question_id, Question.deleted_at.is_(None))
        )
        question = result.scalar_one_or_none()
        if not question:
            return None

        # 检查题目是否属于当前用户的知识库
        kb_result = await session.execute(
            select(Knowledge).where(
                and_(
                    Knowledge.id == question.knowledge_id,
                    Knowledge.user_id == user_id,
                )
            )
        )
        knowledge = kb_result.scalar_one_or_none()
        if not knowledge:
            return None

        return QuestionResponse(
            id=question.id,
            category=question.category,
            difficulty=question.difficulty,
            question=question.question,
            answer=question.answer,
            keywords=json.loads(question.keywords) if question.keywords else [],
            source=question.source,
            created_at=question.created_at.isoformat(),
            updated_at=question.updated_at.isoformat(),
        )


async def delete_question(question_id: str, user_id: str) -> bool:
    """删除题目。"""
    async with get_session_context() as session:
        result = await session.execute(
            select(Question).where(Question.id == question_id, Question.deleted_at.is_(None))
        )
        question = result.scalar_one_or_none()
        if not question:
            return False

        # 检查题目是否属于当前用户的知识库
        kb_result = await session.execute(
            select(Knowledge).where(
                and_(
                    Knowledge.id == question.knowledge_id,
                    Knowledge.user_id == user_id,
                )
            )
        )
        knowledge = kb_result.scalar_one_or_none()
        if not knowledge:
            return False

        # 保留正在进行的面试及历史成绩，检索和新选题排除此记录。
        question.deleted_at = _utcnow()
        await session.commit()
        await retrieval_service.sync_knowledge(question.knowledge_id, user_id)
        return True
