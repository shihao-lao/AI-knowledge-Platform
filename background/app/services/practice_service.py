# -*- coding: utf-8 -*-
"""练习服务：答案评估和统计。"""

from __future__ import annotations

import json
from typing import List, Optional

from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import PracticeRecord, Question, User
from app.infrastructure.database.session import get_async_session
from app.models.schemas import (
    PracticeEvaluateRequest,
    PracticeEvaluateResponse,
    PracticeStatsResponse,
    PracticeRecordResponse,
)


async def evaluate_answer(
    question_id: str,
    user_id: str,
    user_answer: str,
) -> PracticeEvaluateResponse:
    """评估用户答案。"""
    async with get_async_session() as session:
        # 检查题目是否存在
        question_result = await session.execute(
            select(Question).where(Question.id == question_id)
        )
        question = question_result.scalar_one_or_none()
        if not question:
            raise ValueError("题目不存在")

        # 检查用户是否存在
        user_result = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = user_result.scalar_one_or_none()
        if not user:
            raise ValueError("用户不存在")

        # 评估答案（这里使用简单的关键词匹配，实际应该使用 LLM）
        score, feedback = await _evaluate_answer_with_llm(
            question.question,
            question.answer,
            user_answer,
            question.keywords,
        )

        # 保存练习记录
        practice_record = PracticeRecord(
            question_id=question_id,
            user_id=user_id,
            mode="question",
            user_answer=user_answer,
            score=score,
            feedback=feedback,
        )
        session.add(practice_record)
        await session.commit()
        await session.refresh(practice_record)

        return PracticeEvaluateResponse(
            id=practice_record.id,
            question_id=question_id,
            score=score,
            feedback=feedback,
            evaluated_at=practice_record.evaluated_at.isoformat(),
        )


async def _evaluate_answer_with_llm(
    question: str,
    reference_answer: str,
    user_answer: str,
    keywords: List[str],
) -> tuple[int, str]:
    """使用 LLM 评估答案。"""
    # 这里应该调用实际的 LLM 进行评估
    # 暂时返回模拟结果

    # 简单的关键词匹配评分
    if not user_answer.strip():
        return 0, "答案为空"

    # 检查关键词命中
    keyword_hits = 0
    for keyword in keywords:
        if keyword.lower() in user_answer.lower():
            keyword_hits += 1

    # 计算分数
    if len(keywords) > 0:
        keyword_score = int((keyword_hits / len(keywords)) * 100)
    else:
        keyword_score = 50  # 如果没有关键词，给默认分

    # 答案长度评分
    length_score = min(len(user_answer) / 100 * 100, 100)

    # 综合分数
    score = int((keyword_score * 0.7) + (length_score * 0.3))
    score = min(max(score, 0), 100)

    # 生成反馈
    if score >= 80:
        feedback = "回答很好！涵盖了关键知识点。"
    elif score >= 60:
        feedback = "回答基本正确，但可以更全面。"
    elif score >= 40:
        feedback = "回答部分正确，建议补充关键点。"
    else:
        feedback = "回答不够完整，建议重新复习相关知识点。"

    return score, feedback


async def get_practice_stats(
    user_id: str,
    knowledge_id: Optional[str] = None,
) -> PracticeStatsResponse:
    """获取练习统计。"""
    async with get_async_session() as session:
        # 使用数据库聚合函数优化查询
        from sqlalchemy import func, case
        
        # 构建基础查询
        base_query = select(PracticeRecord).where(PracticeRecord.user_id == user_id)
        
        if knowledge_id:
            base_query = base_query.join(Question).where(Question.knowledge_id == knowledge_id)
        
        # 获取统计信息（使用数据库聚合）
        stats_query = select(
            func.count(PracticeRecord.id).label('total_count'),
            func.avg(PracticeRecord.score).label('average_score'),
            func.max(PracticeRecord.score).label('highest_score'),
            func.min(PracticeRecord.score).label('lowest_score'),
        ).where(PracticeRecord.user_id == user_id)
        
        if knowledge_id:
            stats_query = stats_query.join(Question).where(Question.knowledge_id == knowledge_id)
        
        stats_result = await session.execute(stats_query)
        stats = stats_result.one()
        
        if stats.total_count == 0:
            return PracticeStatsResponse(
                total_count=0,
                average_score=0,
                highest_score=0,
                lowest_score=0,
                recent_records=[],
            )
        
        # 获取最近记录（使用数据库排序和限制）
        recent_query = (
            base_query
            .order_by(PracticeRecord.evaluated_at.desc())
            .limit(10)
        )
        
        recent_result = await session.execute(recent_query)
        recent_records = recent_result.scalars().all()
        
        recent_records_response = [
            PracticeRecordResponse(
                id=r.id,
                question_id=r.question_id,
                mode=r.mode,
                score=r.score,
                feedback=r.feedback,
                evaluated_at=r.evaluated_at.isoformat(),
            )
            for r in recent_records
        ]
        
        return PracticeStatsResponse(
            total_count=stats.total_count,
            average_score=round(float(stats.average_score), 2),
            highest_score=stats.highest_score,
            lowest_score=stats.lowest_score,
            recent_records=recent_records_response,
        )