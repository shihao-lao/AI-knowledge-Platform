# -*- coding: utf-8 -*-
"""测试 include_router 函数。"""

import sys
import os

# 添加当前目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 模拟缺失的模块
class MockModule:
    def __getattr__(self, name):
        return MockModule()
    
    def __call__(self, *args, **kwargs):
        return MockModule()

# 模拟所有可能缺失的模块
for mod in ['jose', 'jose.jwt', 'jose.exceptions', 'passlib', 'passlib.context', 'bcrypt']:
    if mod not in sys.modules:
        sys.modules[mod] = MockModule()

# 设置环境变量
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-testing-only")

print("="*60)
print("测试 include_router 函数")
print("="*60 + "\n")

try:
    from fastapi import FastAPI, APIRouter
    from app.api.routes import health, auth
    from app.config import get_settings
    
    settings = get_settings()
    
    # 创建测试应用
    app = FastAPI()
    
    print("测试 health 路由注册:")
    print(f"  health.router 类型: {type(health.router)}")
    print(f"  health.router.routes: {len(health.router.routes)}")
    
    # 尝试注册路由
    result = app.include_router(health.router, prefix=settings.api_prefix)
    print(f"  include_router 返回值: {result}")
    print(f"  include_router 返回类型: {type(result)}")
    
    # 检查路由是否注册成功
    print(f"  应用路由总数: {len(app.routes)}")
    
    # 列出所有路由
    print("\n  应用路由:")
    for route in app.routes:
        if hasattr(route, 'path'):
            methods = getattr(route, 'methods', set())
            if methods:
                print(f"    {methods} {route.path}")
    
    print("\n测试 auth 路由注册:")
    print(f"  auth.router 类型: {type(auth.router)}")
    print(f"  auth.router.routes: {len(auth.router.routes)}")
    
    # 尝试注册路由
    result = app.include_router(auth.router, prefix=settings.api_prefix)
    print(f"  include_router 返回值: {result}")
    print(f"  include_router 返回类型: {type(result)}")
    
    # 检查路由是否注册成功
    print(f"  应用路由总数: {len(app.routes)}")
    
    # 列出所有路由
    print("\n  应用路由:")
    for route in app.routes:
        if hasattr(route, 'path'):
            methods = getattr(route, 'methods', set())
            if methods:
                print(f"    {methods} {route.path}")
    
except Exception as e:
    print(f"测试失败: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*60)
print("测试完成")
print("="*60)