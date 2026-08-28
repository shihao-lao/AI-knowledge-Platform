# -*- coding: utf-8 -*-
"""检查实际路由。"""

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


def get_all_routes_from_router(router, prefix=""):
    """从路由器获取所有路由。"""
    routes = []
    
    for route in router.routes:
        if hasattr(route, "path"):
            # 普通路由
            methods = getattr(route, "methods", set())
            path = prefix + route.path
            routes.append({
                "path": path,
                "methods": methods,
                "name": getattr(route, "name", ""),
            })
        elif hasattr(route, "routes"):
            # 嵌套路由器
            sub_prefix = prefix + getattr(route, "path", "")
            routes.extend(get_all_routes_from_router(route, sub_prefix))
        elif hasattr(route, "original_router"):
            # _IncludedRouter
            include_context = getattr(route, "include_context", None)
            if include_context and hasattr(include_context, "prefix"):
                sub_prefix = prefix + include_context.prefix
            else:
                sub_prefix = prefix
            routes.extend(get_all_routes_from_router(route.original_router, sub_prefix))
    
    return routes


def main():
    """主函数。"""
    print("=" * 60)
    print("Actual Routes")
    print("=" * 60)
    
    # 导入应用
    try:
        from app.main import app
        print(f"SUCCESS: FastAPI app imported")
    except Exception as e:
        print(f"FAIL: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # 获取所有路由
    routes = get_all_routes_from_router(app)
    
    print(f"\nTotal routes: {len(routes)}")
    
    # 查找知识库相关路由
    print("\nKnowledge routes:")
    for route in routes:
        if "knowledge" in route["path"].lower():
            print(f"  {route['methods']} {route['path']}")
    
    # 查找文档相关路由
    print("\nDocument routes:")
    for route in routes:
        if "document" in route["path"].lower():
            print(f"  {route['methods']} {route['path']}")
    
    # 查找对话相关路由
    print("\nConversation routes:")
    for route in routes:
        if "conversation" in route["path"].lower():
            print(f"  {route['methods']} {route['path']}")
    
    # 查找题库相关路由
    print("\nQuestion routes:")
    for route in routes:
        if "question" in route["path"].lower():
            print(f"  {route['methods']} {route['path']}")
    
    return True


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)