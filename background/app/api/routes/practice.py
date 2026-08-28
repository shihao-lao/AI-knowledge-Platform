# -*- coding: utf-8 -*-
"""练习 API：答案评估和统计。"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger

from app.api.routes.auth import get_current_user_dependency
from app.models.schemas import (
    PracticeEvaluateRequest,
    PracticeEvaluateResponse,
    PracticeStatsResponse,
    UserResponse,
)
from app.services.practice_service import (
    evaluate_answer,
    get_practice_stats,
)

router = APIRouter(tags=["practice"])


@router.post("/practice/evaluate", response_model=dict, status_code=status.HTTP_201_CREATED)
async def evaluate_answer_endpoint(
    evaluate_data: PracticeEvaluateRequest,
    current_user: UserResponse = Depends(get_current_user_dependency),
) -> dict:
    """评估用户答案。"""
    try:
        # 验证请求参数
        if not evaluate_data.question_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="questionId 不能为空",
            )
        if not evaluate_data.user_answer or len(evaluate_data.user_answer.strip()) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="回答不能为空",
            )
        if len(evaluate_data.user_answer) > 20000:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="回答过长",
            )

        # 评估答案
        result = await evaluate_answer(
            question_id=evaluate_data.question_id,
            user_id=current_user.id,
            user_answer=evaluate_data.user_answer.strip(),
        )

        logger.info("评估答案成功: {}", result.id)
        return {"data": result}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except Exception as e:
        logger.exception("评估答案失败: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="评估答案失败",
        )


@router.get("/practice/stats", response_model=dict)
async def get_practice_stats_endpoint(
    knowledge_id: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user_dependency),
) -> dict:
    """获取练习统计。"""
    try:
        stats = await get_practice_stats(
            user_id=current_user.id,
            knowledge_id=knowledge_id,
        )
        return {"data": stats}
    except Exception as e:
        logger.exception("获取练习统计失败: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取练习统计失败",
        )