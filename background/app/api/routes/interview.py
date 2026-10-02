"""归属校验由面试服务统一执行。"""
from fastapi import APIRouter, Depends, HTTPException
from loguru import logger

from app.api.routes.auth import get_current_user_dependency
from app.models.interview import InterviewAnswer, InterviewNext, InterviewResult, InterviewStart
from app.models.schemas import UserResponse
from app.services import interview_service as service

router = APIRouter(tags=['interview'])


async def _call(operation):
    try:
        return {'data': await operation}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except service.InterviewConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.warning('面试操作失败: {}', type(exc).__name__)
        raise HTTPException(status_code=503, detail='面试服务暂不可用，请重试；当前进度已保留') from exc


@router.get('/conversations/{conversation_id}/interview',
            response_model=dict[str, InterviewResult | None])
async def get_interview(conversation_id: str,
                        user: UserResponse = Depends(get_current_user_dependency)):
    return await _call(service.get_interview(conversation_id, user.id))


@router.post('/conversations/{conversation_id}/interview',
             response_model=dict[str, InterviewResult])
async def start_interview(conversation_id: str, request: InterviewStart,
                          user: UserResponse = Depends(get_current_user_dependency)):
    return await _call(service.start_interview(conversation_id, user.id, request))


@router.post('/conversations/{conversation_id}/interview/answers',
             response_model=dict[str, InterviewResult])
async def answer_interview(conversation_id: str, request: InterviewAnswer,
                           user: UserResponse = Depends(get_current_user_dependency)):
    return await _call(service.answer_interview(conversation_id, user.id, request))


@router.post('/conversations/{conversation_id}/interview/next',
             response_model=dict[str, InterviewResult])
async def next_question(conversation_id: str, request: InterviewNext,
                        user: UserResponse = Depends(get_current_user_dependency)):
    return await _call(service.next_question(conversation_id, user.id, request.turn_id))
