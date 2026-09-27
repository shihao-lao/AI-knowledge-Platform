# -*- coding: utf-8 -*-
"""认证服务：用户注册、登录、JWT 令牌管理。"""

from __future__ import annotations

import os
from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import User
from app.infrastructure.database.session import get_async_session, get_session_context
from app.models.schemas import UserCreate, UserLogin, UserResponse

# 密码哈希 - 使用 bcrypt 直接调用
import bcrypt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码。"""
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password.encode('utf-8')
        )
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    """生成密码哈希。"""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

# JWT 配置 - 从环境变量读取，如果没有则使用默认值
def get_secret_key() -> str:
    """Fail closed for missing, weak or sample JWT signing keys."""
    key = os.environ.get("SECRET_KEY", "").strip()
    if len(key.encode("utf-8")) < 32 or key.lower() in {
        "your-secret-key-change-in-production",
        "please-change-me-to-a-long-random-string",
    }:
        raise RuntimeError("SECRET_KEY 必须配置为至少 32 字节的随机密钥，不能使用示例值")
    return key

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))  # 默认保持登录 7 天，可通过环境变量覆盖


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """创建 JWT 访问令牌。"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, get_secret_key(), algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> Optional[dict]:
    """验证 JWT 令牌。"""
    try:
        payload = jwt.decode(token, get_secret_key(), algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


async def authenticate_user(email: str, password: str) -> Optional[User]:
    """验证用户凭据。"""
    async with get_session_context() as session:
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if not user:
            return None
        if not verify_password(password, user.password_hash):
            return None
        return user


async def create_user(user_data: UserCreate) -> User:
    """创建新用户。"""
    async with get_session_context() as session:
        # 检查邮箱是否已存在
        result = await session.execute(select(User).where(User.email == user_data.email))
        existing_user = result.scalar_one_or_none()
        if existing_user:
            raise ValueError("该邮箱已注册")

        # 创建用户
        hashed_password = get_password_hash(user_data.password)
        user = User(
            name=user_data.name,
            email=user_data.email,
            password_hash=hashed_password,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user


async def get_user_by_id(user_id: str) -> Optional[User]:
    """根据用户 ID 获取用户。"""
    async with get_session_context() as session:
        result = await session.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()


async def get_current_user(token: str) -> Optional[User]:
    """从 JWT 令牌获取当前用户。"""
    payload = verify_token(token)
    if payload is None:
        return None

    user_id: str = payload.get("sub")
    if user_id is None:
        return None

    return await get_user_by_id(user_id)
