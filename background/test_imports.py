# -*- coding: utf-8 -*-
"""测试所有模块导入。"""

import sys
import os

# 添加当前目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_imports():
    """测试所有模块导入。"""
    errors = []
    
    # 测试核心模块导入
    try:
        from app.config import get_settings
        print("[OK] app.config 导入成功")
    except Exception as e:
        errors.append(f"[ERROR] app.config 导入失败: {e}")
        print(f"[ERROR] app.config 导入失败: {e}")
    
    # 测试数据库模型导入
    try:
        from app.infrastructure.database.models import Base, User, Knowledge
        print("[OK] app.infrastructure.database.models 导入成功")
    except Exception as e:
        errors.append(f"[ERROR] app.infrastructure.database.models 导入失败: {e}")
        print(f"[ERROR] app.infrastructure.database.models 导入失败: {e}")
    
    # 测试数据库会话导入
    try:
        from app.infrastructure.database.session import get_async_session
        print("[OK] app.infrastructure.database.session 导入成功")
    except Exception as e:
        errors.append(f"[ERROR] app.infrastructure.database.session 导入失败: {e}")
        print(f"[ERROR] app.infrastructure.database.session 导入失败: {e}")
    
    # 测试 schemas 导入
    try:
        from app.models.schemas import UserCreate, ChatRequest
        print("[OK] app.models.schemas 导入成功")
    except Exception as e:
        errors.append(f"[ERROR] app.models.schemas 导入失败: {e}")
        print(f"[ERROR] app.models.schemas 导入失败: {e}")
    
    # 测试服务层导入
    try:
        from app.services.auth_service import create_user
        print("[OK] app.services.auth_service 导入成功")
    except Exception as e:
        errors.append(f"[ERROR] app.services.auth_service 导入失败: {e}")
        print(f"[ERROR] app.services.auth_service 导入失败: {e}")
    
    # 测试路由导入
    try:
        from app.api.routes.auth import router
        print("[OK] app.api.routes.auth 导入成功")
    except Exception as e:
        errors.append(f"[ERROR] app.api.routes.auth 导入失败: {e}")
        print(f"[ERROR] app.api.routes.auth 导入失败: {e}")
    
    # 测试中间件导入
    try:
        from app.middleware.rate_limit import RateLimitMiddleware
        print("[OK] app.middleware.rate_limit 导入成功")
    except Exception as e:
        errors.append(f"[ERROR] app.middleware.rate_limit 导入失败: {e}")
        print(f"[ERROR] app.middleware.rate_limit 导入失败: {e}")
    
    return errors

if __name__ == "__main__":
    print("开始测试模块导入...")
    print("=" * 50)
    
    errors = test_imports()
    
    print("=" * 50)
    if errors:
        print(f"发现 {len(errors)} 个导入错误:")
        for error in errors:
            print(f"  - {error}")
        sys.exit(1)
    else:
        print("[OK] 所有模块导入成功")
        sys.exit(0)