# -*- coding: utf-8 -*-
"""认证 API：注册、登录、登出、用户信息。"""

from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from loguru import logger

from app.models.schemas import (
    UserCreate,
    UserLogin,
    UserResponse,
    TokenResponse,
)
from app.services.auth_service import (
    authenticate_user,
    create_access_token,
    create_user,
    get_current_user,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)

router = APIRouter(tags=["auth"])

# HTTP Bearer 认证方案
security = HTTPBearer()


async def get_current_user_dependency(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> UserResponse:
    """获取当前用户的依赖项。"""
    token = credentials.credentials
    user = await get_current_user(token)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的认证凭据",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        created_at=user.created_at.isoformat(),
    )


@router.post("/auth/register", response_model=dict, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate) -> dict:
    """用户注册。"""
    try:
        user = await create_user(user_data)
        logger.info("用户注册成功: {}", user.email)
        return {
            "data": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
            }
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )
    except Exception as e:
        logger.exception("注册失败: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="注册失败",
        )


@router.post("/auth/login", response_model=dict)
async def login(user_data: UserLogin) -> dict:
    """用户登录。"""
    try:
        user = await authenticate_user(user_data.email, user_data.password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="邮箱或密码错误",
            )

        # 创建访问令牌
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.id},
            expires_delta=access_token_expires,
        )

        logger.info("用户登录成功: {}", user.email)
        # 返回格式与前端期望一致
        return {
            "data": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
            },
            "access_token": access_token,
            "token_type": "bearer",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("登录失败: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="登录失败",
        )


@router.post("/auth/logout")
async def logout() -> dict:
    """用户登出（JWT 无状态，客户端只需删除令牌）。"""
    return {"message": "登出成功"}


@router.get("/auth/me", response_model=dict)
async def get_me(current_user: UserResponse = Depends(get_current_user_dependency)) -> dict:
    """获取当前用户信息。"""
    return {
        "data": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "created_at": current_user.created_at,
        }
    }