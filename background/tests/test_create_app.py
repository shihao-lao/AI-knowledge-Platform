# -*- coding: utf-8 -*-
"""测试 create_app 函数。"""

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


def test_create_app():
    """测试 create_app 函数。"""
    try:
        from app.main import create_app, app
        
        print("Testing create_app function...")
        application = create_app()
        
        print(f"App created: {application}")
        print(f"App type: {type(application)}")
        print(f"App routes: {len(application.routes)}")
        
        print("\nRoutes in created app:")
        for route in application.routes:
            if hasattr(route, "path"):
                methods = getattr(route, "methods", set())
                print(f"  {methods} {route.path}")
        
        print(f"\nModule-level app: {app}")
        print(f"Module-level app routes: {len(app.routes)}")
        
        print("\nRoutes in module-level app:")
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
    print("Create App Test")
    print("=" * 60)
    
    success = test_create_app()
    sys.exit(0 if success else 1)