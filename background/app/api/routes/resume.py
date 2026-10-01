# -*- coding: utf-8 -*-
"""简历 API：简历上传、结构化编辑、导出。"""

from __future__ import annotations

from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from loguru import logger
from pydantic import BaseModel

from app.api.routes.auth import get_current_user_dependency
from app.models.resume_structure import StructuredResume
from app.models.schemas import UserResponse
from app.services.resume_service import (
    get_resume,
    delete_resume,
    export_resume,
    get_user_resumes,
    reparse_resume_structure,
    update_resume_structure,
    upload_and_analyze_resume,
)


class ResumeStructureBody(BaseModel):
    """保存结构化简历请求体。"""

    structured: StructuredResume


router = APIRouter(tags=["resumes"])


@router.delete('/resumes/{resume_id}', response_model=dict)
async def delete_resume_endpoint(resume_id: str,
    current_user: UserResponse = Depends(get_current_user_dependency)) -> dict:
    if not await delete_resume(resume_id, current_user.id):
        raise HTTPException(status_code=404, detail='简历不存在')
    return {'data': {'deleted': True}}


@router.post("/resumes/upload", response_model=dict, status_code=status.HTTP_201_CREATED)
async def upload_resume_endpoint(
    file: UploadFile = File(..., description="上传的简历文件"),
    current_user: UserResponse = Depends(get_current_user_dependency),
) -> dict:
    """上传简历并进行分析。"""
    try:
        file_data = await file.read()
        filename = file.filename or "unnamed"

        allowed_extensions = [".pdf", ".docx", ".txt", ".md", ".markdown"]
        file_ext = "." + filename.split(".")[-1].lower() if "." in filename else ""
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"不支持的文件类型，支持的类型：{', '.join(allowed_extensions)}",
            )

        if len(file_data) > 20 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="文件大小不能超过 20MB",
            )

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


@router.put("/resumes/{resume_id}/structure", response_model=dict)
async def update_resume_structure_endpoint(
    resume_id: str,
    body: ResumeStructureBody,
    current_user: UserResponse = Depends(get_current_user_dependency),
) -> dict:
    """保存结构化简历（可视化编辑结果）。"""
    try:
        resume = await update_resume_structure(resume_id, current_user.id, body.structured)
        if not resume:
            raise HTTPException(status_code=404, detail="简历不存在")
        return {"data": resume}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("保存结构化简历失败: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="保存结构化简历失败",
        )


@router.post("/resumes/{resume_id}/structure/parse", response_model=dict)
async def reparse_resume_structure_endpoint(
    resume_id: str,
    current_user: UserResponse = Depends(get_current_user_dependency),
) -> dict:
    """从正文重新抽取结构化模块。"""
    try:
        resume = await reparse_resume_structure(resume_id, current_user.id)
        if not resume:
            raise HTTPException(status_code=404, detail="简历不存在")
        return {"data": resume}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("重新解析结构化简历失败: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="重新解析结构化简历失败",
        )


@router.get("/resumes/{resume_id}/export")
async def export_resume_endpoint(
    resume_id: str,
    format: str = "docx",
    style: str = "classic",
    current_user: UserResponse = Depends(get_current_user_dependency),
) -> Response:
    """导出结构化简历为 DOCX / PDF，style: classic | compact | modern。"""
    try:
        result = await export_resume(resume_id, current_user.id, format, style=style)
        if not result:
            raise HTTPException(status_code=404, detail="简历不存在")
        content, media_type, filename = result
        return Response(
            content=content,
            media_type=media_type,
            headers={
                "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}",
            },
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("导出简历失败: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="导出简历失败",
        )
