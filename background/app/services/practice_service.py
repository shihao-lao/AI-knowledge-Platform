"""Answer evaluation and owner-scoped mastery statistics."""
import json
from sqlalchemy import select, func
from app.infrastructure.database.models import Knowledge, PracticeRecord, Question
from app.infrastructure.database.session import get_session_context
from app.infrastructure.llm.evaluation import evaluate as _evaluate_answer_with_llm
from app.models.schemas import PracticeEvaluateResponse, PracticeStatsResponse, PracticeRecordResponse


async def evaluate_response(question: str, reference: str, answer: str, keywords: list[str], user_id: str):
    """单题练习与模拟面试共享同一评分规则和用户模型配置。"""
    return await _evaluate_answer_with_llm(question, reference, answer, keywords, user_id)


async def evaluate_answer(question_id: str, user_id: str, user_answer: str) -> PracticeEvaluateResponse:
    async with get_session_context() as session:
        question = await session.scalar(
            select(Question).join(Knowledge).where(
                Question.id == question_id, Knowledge.user_id == user_id,
                Question.deleted_at.is_(None),
            )
        )
        if question is None:
            raise ValueError('题目不存在')
        try:
            keywords = json.loads(question.keywords or '[]')
            if not isinstance(keywords, list) or not all(isinstance(k, str) for k in keywords):
                raise ValueError('keywords must be a list of strings')
        except ValueError as exc:
            raise RuntimeError('题目关键词数据无效') from exc
        evaluation = await evaluate_response(
            question.question, question.answer, user_answer, keywords, user_id
        )
        record = PracticeRecord(question_id=question_id, user_id=user_id, mode='question',
                                user_answer=user_answer, score=evaluation.score, feedback=evaluation.feedback)
        session.add(record)
        await session.commit()
        await session.refresh(record)
        return PracticeEvaluateResponse(
            id=record.id, record_id=record.id, question_id=question_id, score=record.score,
            feedback=record.feedback, evaluated_at=record.evaluated_at.isoformat(),
            key_points=evaluation.key_points, reference_summary=evaluation.reference_summary,
        )


async def get_practice_stats(user_id: str, knowledge_id: str | None = None) -> PracticeStatsResponse:
    async with get_session_context() as session:
        if knowledge_id and not await session.scalar(select(Knowledge.id).where(
            Knowledge.id == knowledge_id, Knowledge.user_id == user_id
        )):
            raise ValueError('知识库不存在')
        filters = [PracticeRecord.user_id == user_id, Knowledge.user_id == user_id]
        if knowledge_id:
            filters.append(Question.knowledge_id == knowledge_id)
        def scoped(query):
            return query.select_from(PracticeRecord).join(Question).join(Knowledge).where(*filters)
        totals = (await session.execute(scoped(select(
            func.count(PracticeRecord.id), func.avg(PracticeRecord.score),
            func.max(PracticeRecord.score), func.min(PracticeRecord.score),
        )))).one()
        async def groups(column):
            rows = (await session.execute(scoped(select(
                column, func.count(PracticeRecord.id), func.avg(PracticeRecord.score)
            )).group_by(column).order_by(column))).all()
            return [{'key': key, 'count': count, 'average_score': round(float(avg), 2)} for key, count, avg in rows]
        recent_rows = (await session.execute(scoped(select(PracticeRecord, Question))
            .order_by(PracticeRecord.evaluated_at.desc()).limit(10))).all()
        recent_records = [PracticeRecordResponse(id=r.id, question_id=r.question_id, mode=r.mode,
            score=r.score, feedback=r.feedback, evaluated_at=r.evaluated_at.isoformat()) for r, q in recent_rows]
        recent = [dict(id=r.id, score=r.score, question=q.question, category=q.category,
            difficulty=q.difficulty, evaluated_at=r.evaluated_at.isoformat()) for r, q in recent_rows]
        return PracticeStatsResponse(total_count=totals[0], total=totals[0],
            average_score=round(float(totals[1] or 0), 2), highest_score=totals[2] or 0,
            lowest_score=totals[3] or 0, max_score=totals[2] or 0, min_score=totals[3] or 0,
            by_category=await groups(Question.category), by_difficulty=await groups(Question.difficulty),
            recent_records=recent_records, recent=recent)
