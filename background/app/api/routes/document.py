# -*- coding: utf-8 -*-
"""文档 API：上传、列表、详情、删除。"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from loguru import logger

from app.api.routes.auth import get_current_user_dependency
from app.models.schemas import (
    DocumentResponse,
    DocumentUploadResponse,
    UserResponse,
)
from app.services.document_service import (
    delete_document,
    get_document,
    get_documents_by_knowledge,
    upload_document,
)

router = APIRouter(tags=["documents"])


@router.post("/documents/upload", response_model=dict, status_code=status.HTTP_201_CREATED)
async def upload_document_endpoint(
    knowledge_id: str,
    file: UploadFile = File(..., description="上传的文件"),
    current_user: UserResponse = Depends(get_current_user_dependency),
) -> dict:
    """上传文档并执行 ETL 分块。"""
    try:
        # 读取文件内容
        file_data = await file.read()
        filename = file.filename or "unnamed"
        mime_type = file.content_type or "application/octet-stream"

        # 上传文档
        result = await upload_document(
            knowledge_id=knowledge_id,
            file_data=file_data,
            filename=filename,
            mime_type=mime_type,
            user_id=current_user.id,
        )

        logger.info("上传文档成功: {}", filename)
        return {"data": result}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except Exception as e:
        logger.exception("上传文档失败: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="上传文档失败",
        )


@router.get("/documents", response_model=dict)
async def list_documents(
    knowledge_id: str,
    current_user: UserResponse = Depends(get_current_user_dependency),
) -> dict:
    """获取知识库的文档列表。"""
    try:
        documents = await get_documents_by_knowledge(knowledge_id, current_user.id)
        return {"data": documents}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.exception("获取文档列表失败: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取文档列表失败",
        )


@router.get("/documents/{document_id}", response_model=dict)
async def get_document_endpoint(
    document_id: str,
    current_user: UserResponse = Depends(get_current_user_dependency),
) -> dict:
    """获取文档详情。"""
    try:
        document = await get_document(document_id, current_user.id)
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="文档不存在",
            )
        return {"data": document}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("获取文档详情失败: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取文档详情失败",
        )


@router.delete("/documents/{document_id}", response_model=dict)
async def delete_document_endpoint(
    document_id: str,
    current_user: UserResponse = Depends(get_current_user_dependency),
) -> dict:
    """删除文档。"""
    try:
        success = await delete_document(document_id, current_user.id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="文档不存在",
            )
        logger.info("删除文档成功: {}", document_id)
        return {"message": "删除成功"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("删除文档失败: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="删除文档失败",
        )