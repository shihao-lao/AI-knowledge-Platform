# -*- coding: utf-8 -*-
"""创建数据库表。"""

import asyncio
import sys
import os

# 添加当前目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.infrastructure.database.session import init_engine, configure_session
from app.infrastructure.database.models import Base
from app.config import get_settings


async def create_tables():
    """创建数据库表。"""
    settings = get_settings()
    
    print(f"数据库 URL: {settings.database_url}")
    
    # 创建引擎
    engine = init_engine(settings.database_url)
    
    # 创建所有表
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    print("[OK] 数据库表创建成功")
    
    # 关闭引擎
    await engine.dispose()
    print("[OK] 数据库连接已关闭")


if __name__ == "__main__":
    asyncio.run(create_tables())