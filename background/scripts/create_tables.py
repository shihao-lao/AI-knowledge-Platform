# -*- coding: utf-8 -*-
"""直接创建数据库表（不使用 Alembic）。"""

import asyncio
import sys
import os

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.infrastructure.database.session import init_engine, configure_session
from app.infrastructure.database.models import Base
from app.config import get_settings


async def create_tables():
    """创建数据库表。"""
    settings = get_settings()
    
    print(f"正在连接数据库: {settings.database_url.split('@')[1] if '@' in settings.database_url else 'local'}")
    
    # 创建引擎
    engine = init_engine(settings.database_url)
    
    # 创建所有表
    async with engine.begin() as conn:
        # 删除所有表（谨慎使用）
        # await conn.run_sync(Base.metadata.drop_all)
        
        # 创建所有表
        await conn.run_sync(Base.metadata.create_all)
    
    print("✅ 数据库表创建成功")
    
    # 列出创建的表
    async with engine.connect() as conn:
        result = await conn.execute(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
        )
        tables = result.fetchall()
        print(f"\n创建的表 ({len(tables)} 个):")
        for table in tables:
            print(f"  - {table[0]}")
    
    # 关闭引擎
    await engine.dispose()
    print("\n✅ 数据库连接已关闭")


if __name__ == "__main__":
    asyncio.run(create_tables())