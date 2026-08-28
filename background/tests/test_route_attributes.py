# -*- coding: utf-8 -*-
"""测试路由属性。"""

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


def test_route_attributes():
    """测试路由属性。"""
    print("Testing route attributes...")
    
    try:
        from fastapi import FastAPI
        from app.api.routes import health, auth
        
        app = FastAPI()
        
        # 添加路由
        app.include_router(health.router, prefix="/api/v1")
        app.include_router(auth.router, prefix="/api/v1")
        
        print(f"Total routes: {len(app.routes)}")
        
        print("\nAll routes with attributes:")
        for i, route in enumerate(app.routes):
            print(f"\nRoute {i}:")
            print(f"  Type: {type(route)}")
            print(f"  Attributes: {dir(route)}")
            
            if hasattr(route, "path"):
                print(f"  path: {route.path}")
            if hasattr(route, "methods"):
                print(f"  methods: {route.methods}")
            if hasattr(route, "name"):
                print(f"  name: {route.name}")
            if hasattr(route, "endpoint"):
                print(f"  endpoint: {route.endpoint}")
        
        return True
    except Exception as e:
        print(f"FAIL: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    print("=" * 60)
    print("Route Attributes Test")
    print("=" * 60)
    
    success = test_route_attributes()
    sys.exit(0 if success else 1)