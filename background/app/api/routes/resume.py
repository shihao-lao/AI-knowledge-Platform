# -*- coding: utf-8 -*-
"""简历 API：简历上传和分析。"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from loguru import logger

from app.api.routes.auth import get_current_user_dependency
from app.models.schemas import (
    ResumeAnalysisResponse,
    ResumeResponse,
    UserResponse,
)
from app.services.resume_service import (
    get_resume,
    get_user_resumes,
    upload_and_analyze_resume,
)

router = APIRouter(tags=["resumes"])


@router.post("/resumes/upload", response_model=dict, status_code=status.HTTP_201_CREATED)
async def upload_resume_endpoint(
    file: UploadFile = File(..., description="上传的简历文件"),
    current_user: UserResponse = Depends(get_current_user_dependency),
) -> dict:
    """上传简历并进行分析。"""
    try:
        # 读取文件内容
        file_data = await file.read()
        filename = file.filename or "unnamed"

        # 验证文件类型
        allowed_extensions = [".pdf", ".doc", ".docx", ".txt"]
        file_ext = "." + filename.split(".")[-1].lower() if "." in filename else ""
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"不支持的文件类型，支持的类型：{', '.join(allowed_extensions)}",
            )

        # 验证文件大小（最大 10MB）
        if len(file_data) > 10 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="文件大小不能超过 10MB",
            )

        # 上传并分析简历
        result = await upload_and_analyze_resume(
            user_id=current_user.id,
            file_data=file_data,
            filename=filename,
        )

        logger.info("上传简历成功: {}", filename)
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
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("上传简历失败: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="上传简历失败",
        )


@router.get("/resumes", response_model=dict)
async def list_resumes_endpoint(
    current_user: UserResponse = Depends(get_current_user_dependency),
) -> dict:
    """获取用户的简历列表。"""
    try:
        resumes = await get_user_resumes(current_user.id)
        return {"data": resumes}
    except Exception as e:
        logger.exception("获取简历列表失败: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取简历列表失败",
        )


@router.get("/resumes/{resume_id}", response_model=dict)
async def get_resume_endpoint(
    resume_id: str,
    current_user: UserResponse = Depends(get_current_user_dependency),
) -> dict:
    """获取简历详情。"""
    try:
        resume = await get_resume(resume_id, current_user.id)
        if not resume:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="简历不存在",
            )
        return {"data": resume}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("获取简历详情失败: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取简历详情失败",
        )