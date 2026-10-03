"""持久化面试流程：固定选题、逐题作答、共享评分、总结与恢复。"""
import json
from datetime import timedelta

from sqlalchemy import select

from app.infrastructure.database.models import (
    Conversation, InterviewSession, InterviewTurn, Knowledge, PracticeRecord, Question, _utcnow,
)
from app.infrastructure.database.session import get_session_context
from app.models.interview import InterviewAnswer, InterviewResult, InterviewStart, TurnResult
from app.services.practice_service import evaluate_response


class InterviewConflict(Exception):
    """进度已变化，客户端需要刷新当前场次。"""


async def _owned_conversation(session, conversation_id, user_id, *, lock=False):
    query = select(Conversation).join(Knowledge).where(
        Conversation.id == conversation_id, Knowledge.user_id == user_id,
    )
    if lock:
        query = query.with_for_update()
    conversation = await session.scalar(query)
    if conversation is None:
        raise LookupError('对话不存在')
    return conversation


async def _turns(session, interview_id):
    return list((await session.scalars(select(InterviewTurn).where(
        InterviewTurn.interview_id == interview_id,
    ).order_by(InterviewTurn.position))).all())


def _iso_datetime(value):
    return (value + timedelta(microseconds=500_000)).replace(microsecond=0).isoformat() if value else None


def _result(interview, turns):
    return InterviewResult(
        id=interview.id, conversation_id=interview.conversation_id,
        status=interview.status, current_position=interview.current_position,
        turns=[TurnResult(
            id=t.id, position=t.position, question=t.question, category=t.category,
            difficulty=t.difficulty, user_answer=t.user_answer, evaluation=t.evaluation,
        ) for t in turns],
        summary=interview.summary, created_at=_iso_datetime(interview.created_at),
        completed_at=_iso_datetime(interview.completed_at),
    )


async def get_interview(conversation_id: str, user_id: str):
    async with get_session_context() as session:
        await _owned_conversation(session, conversation_id, user_id)
        interview = await session.scalar(select(InterviewSession).where(
            InterviewSession.conversation_id == conversation_id,
        ))
        return _result(interview, await _turns(session, interview.id)) if interview else None


async def start_interview(conversation_id: str, user_id: str, request: InterviewStart):
    async with get_session_context() as session:
        conversation = await _owned_conversation(session, conversation_id, user_id, lock=True)
        existing = await session.scalar(select(InterviewSession).where(
            InterviewSession.conversation_id == conversation_id,
        ))
        if existing:
            return _result(existing, await _turns(session, existing.id))
        query = select(Question).where(
            Question.knowledge_id == conversation.knowledge_id, Question.deleted_at.is_(None),
        )
        if request.category:
            query = query.where(Question.category == request.category)
        if request.difficulty:
            query = query.where(Question.difficulty == request.difficulty)
        questions = list((await session.scalars(query.order_by(
            Question.created_at, Question.id,
        ).limit(request.question_count))).all())
        if not questions:
            raise ValueError('没有符合条件的题目，请先导入题目或调整筛选条件')
        interview = InterviewSession(conversation_id=conversation_id)
        session.add(interview)
        await session.flush()
        for position, question in enumerate(questions):
            session.add(InterviewTurn(
                interview_id=interview.id, question_id=question.id, position=position,
                question=question.question, reference_answer=question.answer,
                keywords=json.loads(question.keywords or '[]'),
                category=question.category, difficulty=question.difficulty,
            ))
        await session.commit()
        return _result(interview, await _turns(session, interview.id))


async def _locked_interview(session, conversation_id, user_id):
    # 所有变更采用同样的锁顺序；跨进程重复请求也不会重复评分/跳题。
    await _owned_conversation(session, conversation_id, user_id, lock=True)
    interview = await session.scalar(select(InterviewSession).where(
        InterviewSession.conversation_id == conversation_id,
    ).with_for_update())
    if interview is None:
        raise LookupError('面试尚未开始')
    return interview, await _turns(session, interview.id)


async def answer_interview(conversation_id: str, user_id: str, request: InterviewAnswer):
    async with get_session_context() as session:
        interview, turns = await _locked_interview(session, conversation_id, user_id)
        turn = next((t for t in turns if t.id == request.turn_id), None)
        if turn is None:
            raise InterviewConflict('题目不属于本场面试')
        if turn.evaluation is not None:
            if turn.user_answer != request.answer:
                raise InterviewConflict('此题已评分，不能覆盖原作答')
            return _result(interview, turns)
        if interview.status != 'answering' or turn.position != interview.current_position:
            raise InterviewConflict('请按当前面试进度作答')
        if turn.question_id is None:
            raise InterviewConflict('当前题目已被删除，请新建对话重新开始面试')
        # 评分失败会回滚事务，保留当前题；不会写入空分数或推进进度。
        evaluation = await evaluate_response(
            turn.question, turn.reference_answer, request.answer, turn.keywords, user_id,
        )
        record = PracticeRecord(
            question_id=turn.question_id, user_id=user_id, mode='mock',
            user_answer=request.answer, score=evaluation.score, feedback=evaluation.feedback,
        )
        session.add(record)
        await session.flush()
        turn.user_answer = request.answer
        turn.evaluation = {**evaluation.model_dump(), 'record_id': record.id}
        interview.status = 'reviewing'
        await session.commit()
        return _result(interview, turns)


async def next_question(conversation_id: str, user_id: str, turn_id: str):
    async with get_session_context() as session:
        interview, turns = await _locked_interview(session, conversation_id, user_id)
        turn = next((t for t in turns if t.id == turn_id), None)
        if turn is None:
            raise InterviewConflict('题目不属于本场面试')
        if turn.position < interview.current_position or interview.status == 'completed':
            return _result(interview, turns)
        if turn.position != interview.current_position or turn.evaluation is None:
            raise InterviewConflict('请先完成当前题目的作答和评分')
        if interview.current_position + 1 < len(turns):
            interview.current_position += 1
            interview.status = 'answering'
        else:
            interview.status = 'completed'
            interview.completed_at = _utcnow()
            interview.summary = {
                'question_count': len(turns),
                'average_score': round(sum(t.evaluation['score'] for t in turns) / len(turns), 2),
                'key_points': list(dict.fromkeys(
                    point for t in turns for point in t.evaluation['key_points']
                )),
            }
        await session.commit()
        return _result(interview, turns)
