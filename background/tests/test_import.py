# -*- coding: utf-8 -*-
"""测试导入。"""

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


def test_import_routes():
    """测试导入路由模块。"""
    try:
        from app.api.routes import auth
        print(f"SUCCESS: auth router imported, type: {type(auth)}")
        print(f"  Router: {auth.router}")
        print(f"  Routes: {len(auth.router.routes)}")
    except Exception as e:
        print(f"FAIL: {e}")
        import traceback
        traceback.print_exc()


def test_import_health():
    """测试导入健康检查路由。"""
    try:
        from app.api.routes import health
        print(f"SUCCESS: health router imported, type: {type(health)}")
        print(f"  Router: {health.router}")
        print(f"  Routes: {len(health.router.routes)}")
    except Exception as e:
        print(f"FAIL: {e}")
        import traceback
        traceback.print_exc()


def test_import_main():
    """测试导入主应用。"""
    try:
        from app.main import app
        print(f"SUCCESS: main app imported")
        print(f"  App: {app}")
        print(f"  Routes: {len(app.routes)}")
    except Exception as e:
        print(f"FAIL: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    print("=" * 60)
    print("Import Test")
    print("=" * 60)
    
    test_import_routes()
    print()
    test_import_health()
    print()
    test_import_main()