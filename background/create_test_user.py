# -*- coding: utf-8 -*-
"""创建测试用户。"""

import asyncio
import sys
import os

# 添加当前目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.infrastructure.database.session import init_engine, configure_session, get_session_context
from app.infrastructure.database.models import User
from app.services.auth_service import get_password_hash
from app.config import get_settings
from sqlalchemy import select


async def create_test_user():
    """创建测试用户。"""
    # 初始化数据库引擎
    settings = get_settings()
    engine = init_engine(settings.database_url)
    configure_session(engine)
    
    async with get_session_context() as session:
        # 检查是否已有测试用户
        result = await session.execute(
            select(User).where(User.email == "test@example.com")
        )
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            print("[INFO] 测试用户已存在")
            print(f"ID: {existing_user.id}")
            print(f"姓名: {existing_user.name}")
            print(f"邮箱: {existing_user.email}")
            return
        
        # 创建测试用户
        hashed_password = get_password_hash("Test1234")
        user = User(
            name="测试用户",
            email="test@example.com",
            password_hash=hashed_password,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        
        print("[OK] 测试用户创建成功")
        print(f"ID: {user.id}")
        print(f"姓名: {user.name}")
        print(f"邮箱: {user.email}")
        print(f"密码: Test1234")


if __name__ == "__main__":
    asyncio.run(create_test_user())