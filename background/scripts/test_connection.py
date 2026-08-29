# -*- coding: utf-8 -*-
"""测试数据库连接。"""

import asyncio
import sys
import os

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.infrastructure.database.session import init_engine
from app.config import get_settings


async def test_connection():
    """测试数据库连接。"""
    settings = get_settings()
    
    print(f"数据库 URL: {settings.database_url.split('@')[1] if '@' in settings.database_url else 'local'}")
    
    try:
        # 创建引擎
        engine = init_engine(settings.database_url)
        
        # 测试连接
        async with engine.connect() as conn:
            result = await conn.execute("SELECT 1")
            print("✅ 数据库连接成功")
            
            # 尝试获取数据库版本
            try:
                result = await conn.execute("SELECT version()")
                version = result.scalar()
                print(f"数据库版本: {version}")
            except Exception as e:
                print(f"无法获取数据库版本: {e}")
        
        # 关闭引擎
        await engine.dispose()
        print("✅ 数据库连接测试完成")
        
    except Exception as e:
        print(f"❌ 数据库连接失败: {e}")
        print("\n请检查:")
        print("1. 数据库是否正在运行")
        print("2. 数据库 URL 是否正确")
        print("3. 数据库用户是否有权限")
        print("4. 防火墙是否允许连接")
        return False
    
    return True


if __name__ == "__main__":
    success = asyncio.run(test_connection())
    sys.exit(0 if success else 1)