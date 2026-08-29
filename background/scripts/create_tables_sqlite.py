# -*- coding: utf-8 -*-
"""使用 SQLite 创建数据库表（用于本地开发）。"""

import asyncio
import sys
import os

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import create_async_engine
from app.infrastructure.database.models import Base


async def create_tables_sqlite():
    """使用 SQLite 创建数据库表。"""
    # SQLite 数据库文件路径
    db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "app.db")
    database_url = f"sqlite+aiosqlite:///{db_path}"
    
    print(f"正在创建 SQLite 数据库: {db_path}")
    
    # 创建引擎
    engine = create_async_engine(database_url, echo=True)
    
    # 创建所有表
    async with engine.begin() as conn:
        # 删除所有表（谨慎使用）
        # await conn.run_sync(Base.metadata.drop_all)
        
        # 创建所有表
        await conn.run_sync(Base.metadata.create_all)
    
    print("✅ SQLite 数据库表创建成功")
    
    # 列出创建的表
    async with engine.connect() as conn:
        result = await conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        tables = result.fetchall()
        print(f"\n创建的表 ({len(tables)} 个):")
        for table in tables:
            print(f"  - {table[0]}")
    
    # 关闭引擎
    await engine.dispose()
    print("\n✅ 数据库连接已关闭")
    print(f"\n数据库文件位置: {db_path}")


if __name__ == "__main__":
    asyncio.run(create_tables_sqlite())