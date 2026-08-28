# -*- coding: utf-8 -*-
"""题库 API：题目的导入、列表、详情、删除。"""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger

from app.api.routes.auth import get_current_user_dependency
from app.models.schemas import (
    QuestionImportRequest,
    QuestionImportResponse,
    QuestionResponse,
    UserResponse,
)
from app.services.question_service import (
    delete_question,
    get_question,
    get_question_categories,
    get_questions_by_knowledge,
    import_questions,
)

router = APIRouter(tags=["questions"])


@router.get("/questions", response_model=dict)
async def list_questions(
    knowledge_id: str,
    category: Optional[str] = None,
    difficulty: Optional[str] = None,
    keyword: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user_dependency),
) -> dict:
    """获取知识库的题目列表。"""
    try:
        questions = await get_questions_by_knowledge(
            knowledge_id=knowledge_id,
            user_id=current_user.id,
            category=category,
            difficulty=difficulty,
            keyword=keyword,
        )

        # 获取分类列表
        categories = await get_question_categories(knowledge_id, current_user.id)

        return {
            "data": questions,
            "categories": categories,
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.exception("获取题目列表失败: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取题目列表失败",
        )


@router.post("/questions/import", response_model=dict, status_code=status.HTTP_201_CREATED)
async def import_questions_endpoint(
    knowledge_id: str,
    import_data: QuestionImportRequest,
    current_user: UserResponse = Depends(get_current_user_dependency),
) -> dict:
    """导入题目。"""
    try:
        result = await import_questions(knowledge_id, current_user.id, import_data)
        logger.info("导入题目成功: {}", result.message)
        return {"data": result}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.exception("导入题目失败: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="导入题目失败",
        )


@router.get("/questions/{question_id}", response_model=dict)
async def get_question_endpoint(
    question_id: str,
    current_user: UserResponse = Depends(get_current_user_dependency),
) -> dict:
    """获取题目详情。"""
    try:
        question = await get_question(question_id, current_user.id)
        if not question:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="题目不存在",
            )
        return {"data": question}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("获取题目详情失败: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取题目详情失败",
        )


@router.delete("/questions/{question_id}", response_model=dict)
async def delete_question_endpoint(
    question_id: str,
    current_user: UserResponse = Depends(get_current_user_dependency),
) -> dict:
    """删除题目。"""
    try:
        success = await delete_question(question_id, current_user.id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="题目不存在",
            )
        logger.info("删除题目成功: {}", question_id)
        return {"message": "删除成功"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("删除题目失败: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="删除题目失败",
        )