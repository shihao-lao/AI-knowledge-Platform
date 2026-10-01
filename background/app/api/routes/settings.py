# -*- coding: utf-8 -*-
"""设置 API：用户大模型配置的读写、连通性测试与模型列表。"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger

from app.api.routes.auth import get_current_user_dependency
from app.models.schemas import (
    LLMConfigResponse,
    LLMConfigUpdate,
    LLMModelsResponse,
    LLMTestRequest,
    LLMTestResponse,
    UserResponse,
)
from app.services import llm_settings_service as service

router = APIRouter(tags=["settings"])


@router.get("/settings/llm", response_model=LLMConfigResponse)
async def read_llm_config(
    current_user: UserResponse = Depends(get_current_user_dependency),
) -> LLMConfigResponse:
    """读取当前生效的大模型配置（密钥以脱敏形式返回）。"""
    return await service.read_llm_settings(current_user.id)


@router.put("/settings/llm", response_model=LLMConfigResponse)
async def update_llm_config(
    payload: LLMConfigUpdate,
    current_user: UserResponse = Depends(get_current_user_dependency),
) -> LLMConfigResponse:
    """保存大模型配置。api_key 留空表示沿用已保存的密钥。"""
    try:
        return await service.save_llm_settings(current_user.id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/settings/llm", response_model=LLMConfigResponse)
async def reset_llm_config(
    current_user: UserResponse = Depends(get_current_user_dependency),
) -> LLMConfigResponse:
    """清除用户配置，回落到服务端默认。"""
    return await service.clear_llm_settings(current_user.id)


@router.post("/settings/llm/test", response_model=LLMTestResponse)
async def test_llm_config(
    payload: LLMTestRequest | None = None,
    current_user: UserResponse = Depends(get_current_user_dependency),
) -> LLMTestResponse:
    """测试连通性；可在保存前带上待测参数。"""
    config = await service.resolve_candidate_config(current_user.id, payload)
    try:
        return await service.test_connection(config)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/settings/llm/models", response_model=LLMModelsResponse)
async def list_llm_models(
    payload: LLMTestRequest | None = None,
    current_user: UserResponse = Depends(get_current_user_dependency),
) -> LLMModelsResponse:
    """拉取服务商支持的模型列表，方便直接选择。"""
    config = await service.resolve_candidate_config(current_user.id, payload)
    try:
        return await service.fetch_models(config)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
