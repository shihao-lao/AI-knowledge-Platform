# -*- coding: utf-8 -*-
"""调试路由注册问题。"""

import sys
import os

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 设置测试环境变量
os.environ["SECRET_KEY"] = "test-secret-key-for-testing-only"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test.db"

# 模拟缺失的模块
class MockModule:
    def __getattr__(self, name):
        return MockModule()
    
    def __call__(self, *args, **kwargs):
        return MockModule()

# 模拟缺失的模块
sys.modules['jose'] = MockModule()
sys.modules['jose.jwt'] = MockModule()
sys.modules['jose.exceptions'] = MockModule()
sys.modules['passlib'] = MockModule()
sys.modules['passlib.context'] = MockModule()
sys.modules['bcrypt'] = MockModule()


def test_import_routers():
    """测试导入路由模块。"""
    print("Testing router imports...")
    
    try:
        from app.api.routes import health
        print(f"  health.router: {health.router}")
        print(f"  health.router.routes: {len(health.router.routes)}")
        for route in health.router.routes:
            print(f"    {route.methods} {route.path}")
    except Exception as e:
        print(f"  FAIL: {e}")
        import traceback
        traceback.print_exc()
    
    try:
        from app.api.routes import auth
        print(f"  auth.router: {auth.router}")
        print(f"  auth.router.routes: {len(auth.router.routes)}")
        for route in auth.router.routes:
            print(f"    {route.methods} {route.path}")
    except Exception as e:
        print(f"  FAIL: {e}")
        import traceback
        traceback.print_exc()


def test_include_router():
    """测试 include_router。"""
    print("\nTesting include_router...")
    
    try:
        from fastapi import FastAPI
        from app.api.routes import health, auth
        
        app = FastAPI()
        
        print(f"Before include_router: {len(app.routes)} routes")
        
        app.include_router(health.router, prefix="/api/v1")
        print(f"After include health.router: {len(app.routes)} routes")
        
        app.include_router(auth.router, prefix="/api/v1")
        print(f"After include auth.router: {len(app.routes)} routes")
        
        print("\nRoutes after include:")
        for route in app.routes:
            if hasattr(route, "path"):
                methods = getattr(route, "methods", set())
                print(f"  {methods} {route.path}")
        
        return True
    except Exception as e:
        print(f"FAIL: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    print("=" * 60)
    print("Debug Router Registration")
    print("=" * 60)
    
    test_import_routers()
    test_include_router()