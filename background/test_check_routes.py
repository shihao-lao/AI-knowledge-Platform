# -*- coding: utf-8 -*-
"""检查路由是否被正确注册。"""

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
print("检查路由是否被正确注册")
print("="*60 + "\n")

try:
    from fastapi import FastAPI, APIRouter
    from app.api.routes import health, auth
    from app.config import get_settings
    
    settings = get_settings()
    
    # 创建测试应用
    app = FastAPI()
    
    print("注册 health 路由...")
    app.include_router(health.router, prefix=settings.api_prefix)
    
    print("注册 auth 路由...")
    app.include_router(auth.router, prefix=settings.api_prefix)
    
    print(f"\n应用路由总数: {len(app.routes)}")
    
    # 详细检查每个路由
    print("\n详细路由信息:")
    for i, route in enumerate(app.routes):
        print(f"\n路由 {i+1}:")
        print(f"  类型: {type(route).__name__}")
        print(f"  路径: {getattr(route, 'path', 'N/A')}")
        print(f"  方法: {getattr(route, 'methods', 'N/A')}")
        print(f"  名称: {getattr(route, 'name', 'N/A')}")
        
        # 检查是否有子路由
        if hasattr(route, 'routes'):
            print(f"  子路由数量: {len(route.routes)}")
            for j, subroute in enumerate(route.routes):
                print(f"    子路由 {j+1}: {getattr(subroute, 'path', 'N/A')}")
    
    # 检查是否有 /api/v1/ 前缀的路由
    print("\n" + "="*60)
    print("检查 API 路由:")
    print("="*60 + "\n")
    
    api_routes = []
    for route in app.routes:
        if hasattr(route, 'path'):
            path = route.path
            if '/api/v1/' in path:
                api_routes.append(route)
                print(f"  [OK] {path}")
    
    if len(api_routes) == 0:
        print("  [WARN] 没有找到 API 路由")
        
        # 检查所有路由
        print("\n  所有路由路径:")
        for route in app.routes:
            if hasattr(route, 'path'):
                print(f"    {route.path}")
    
    print(f"\nAPI 路由总数: {len(api_routes)}")
    
except Exception as e:
    print(f"测试失败: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*60)
print("测试完成")
print("="*60)