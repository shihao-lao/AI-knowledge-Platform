# -*- coding: utf-8 -*-
"""知识库 API：CRUD 操作和搜索。"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger

from app.api.routes.auth import get_current_user_dependency
from app.models.schemas import (
    KnowledgeCreate,
    KnowledgeUpdate,
    KnowledgeResponse,
    UserResponse,
)
from app.services.knowledge_service import (
    create_knowledge_base,
    delete_knowledge_base,
    get_knowledge_base,
    get_user_knowledge_bases,
    search_knowledge_bases,
    update_knowledge_base,
)

router = APIRouter(tags=["knowledge"])


@router.get("/knowledge", response_model=dict)
async def list_knowledge_bases(
    current_user: UserResponse = Depends(get_current_user_dependency),
) -> dict:
    """获取当前用户的知识库列表。"""
    try:
        knowledge_bases = await get_user_knowledge_bases(current_user.id)
        return {"data": knowledge_bases}
    except Exception as e:
        logger.exception("获取知识库列表失败: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取知识库列表失败",
        )


@router.post("/knowledge", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_knowledge(
    kb_data: KnowledgeCreate,
    current_user: UserResponse = Depends(get_current_user_dependency),
) -> dict:
    """创建新知识库。"""
    try:
        knowledge = await create_knowledge_base(current_user.id, kb_data)
        logger.info("创建知识库成功: {}", knowledge.name)
        return {"data": knowledge}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.exception("创建知识库失败: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="创建知识库失败",
        )


@router.get("/knowledge/{knowledge_id}", response_model=dict)
async def get_knowledge(
    knowledge_id: str,
    current_user: UserResponse = Depends(get_current_user_dependency),
) -> dict:
    """获取知识库详情。"""
    try:
        knowledge = await get_knowledge_base(knowledge_id, current_user.id)
        if not knowledge:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="知识库不存在",
            )
        return {"data": knowledge}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("获取知识库详情失败: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取知识库详情失败",
        )


@router.put("/knowledge/{knowledge_id}", response_model=dict)
async def update_knowledge(
    knowledge_id: str,
    kb_data: KnowledgeUpdate,
    current_user: UserResponse = Depends(get_current_user_dependency),
) -> dict:
    """更新知识库。"""
    try:
        knowledge = await update_knowledge_base(knowledge_id, current_user.id, kb_data)
        if not knowledge:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="知识库不存在",
            )
        logger.info("更新知识库成功: {}", knowledge.name)
        return {"data": knowledge}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("更新知识库失败: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="更新知识库失败",
        )


@router.delete("/knowledge/{knowledge_id}", response_model=dict)
async def delete_knowledge(
    knowledge_id: str,
    current_user: UserResponse = Depends(get_current_user_dependency),
) -> dict:
    """删除知识库。"""
    try:
        success = await delete_knowledge_base(knowledge_id, current_user.id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="知识库不存在",
            )
        logger.info("删除知识库成功: {}", knowledge_id)
        return {"message": "删除成功"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("删除知识库失败: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="删除知识库失败",
        )


@router.get("/knowledge/search", response_model=dict)
async def search_knowledge(
    q: str,
    current_user: UserResponse = Depends(get_current_user_dependency),
) -> dict:
    """搜索知识库。"""
    try:
        if not q or len(q.strip()) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="搜索关键词不能为空",
            )
        knowledge_bases = await search_knowledge_bases(current_user.id, q.strip())
        return {"data": knowledge_bases}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("搜索知识库失败: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="搜索知识库失败",
        )