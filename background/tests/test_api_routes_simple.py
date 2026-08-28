# -*- coding: utf-8 -*-
"""API 路由完整性测试（简化版）。"""

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


def test_import():
    """测试导入。"""
    try:
        from app.main import app
        print("SUCCESS: FastAPI app imported successfully")
        print(f"App title: {app.title}")
        print(f"Total routes: {len(app.routes)}")
        
        # 列出所有路由
        print("\nRegistered routes:")
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


def check_route_exists(routes, path, methods):
    """检查路由是否存在。"""
    for route in routes:
        if hasattr(route, "path"):
            route_path = route.path
            route_methods = getattr(route, "methods", set())
            
            # 处理路径参数
            if "{" in path:
                # 将路径参数转换为正则表达式模式
                import re
                pattern = path.replace("{", "(?P<").replace("}", ">[^/]+)")
                if re.match(pattern, route_path):
                    if methods.issubset(route_methods):
                        return True
            else:
                if route_path == path:
                    if methods.issubset(route_methods):
                        return True
    return False


def main():
    """主测试函数。"""
    print("=" * 60)
    print("API Routes Test")
    print("=" * 60)
    
    # 测试导入
    if not test_import():
        return False
    
    from app.main import app
    routes = app.routes
    
    # 定义期望的路由
    expected_routes = [
        # 健康检查
        ("/api/v1/health", {"GET"}),
        ("/api/v1/health/ready", {"GET"}),
        
        # 认证
        ("/api/v1/auth/register", {"POST"}),
        ("/api/v1/auth/login", {"POST"}),
        ("/api/v1/auth/logout", {"POST"}),
        ("/api/v1/auth/me", {"GET"}),
        
        # 知识库
        ("/api/v1/knowledge", {"GET", "POST"}),
        ("/api/v1/knowledge/{knowledge_id}", {"GET", "PUT", "DELETE"}),
        ("/api/v1/knowledge/search", {"GET"}),
        
        # 文档
        ("/api/v1/documents", {"GET"}),
        ("/api/v1/documents/upload", {"POST"}),
        ("/api/v1/documents/{document_id}", {"GET", "DELETE"}),
        
        # 对话
        ("/api/v1/conversations", {"GET", "POST"}),
        ("/api/v1/conversations/{conversation_id}", {"GET", "DELETE"}),
        ("/api/v1/conversations/{conversation_id}/messages", {"GET", "POST"}),
        
        # 聊天
        ("/api/v1/chat", {"POST"}),
        
        # 题库
        ("/api/v1/questions", {"GET"}),
        ("/api/v1/questions/import", {"POST"}),
        ("/api/v1/questions/{question_id}", {"GET", "DELETE"}),
        
        # 练习
        ("/api/v1/practice/evaluate", {"POST"}),
        ("/api/v1/practice/stats", {"GET"}),
        
        # 简历
        ("/api/v1/resumes", {"GET"}),
        ("/api/v1/resumes/upload", {"POST"}),
        ("/api/v1/resumes/{resume_id}", {"GET"}),
    ]
    
    print("\n" + "=" * 60)
    print("Route Check Results")
    print("=" * 60)
    
    passed = 0
    failed = 0
    
    for path, methods in expected_routes:
        if check_route_exists(routes, path, methods):
            print(f"PASS: {path} - {methods}")
            passed += 1
        else:
            print(f"FAIL: {path} - {methods}")
            failed += 1
    
    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"Total: {len(expected_routes)}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Pass rate: {passed/len(expected_routes)*100:.1f}%")
    
    return failed == 0


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)