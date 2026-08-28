# -*- coding: utf-8 -*-
"""API 路由完整性测试。"""

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

from app.main import app


def get_all_routes():
    """获取所有注册的路由。"""
    routes = []
    for route in app.routes:
        if hasattr(route, "path"):
            methods = getattr(route, "methods", set())
            name = getattr(route, "name", "")
            routes.append({
                "path": route.path,
                "methods": methods,
                "name": name,
            })
    return routes


def check_auth_routes(routes):
    """检查认证路由。"""
    print("\n=== 认证路由检查 ===")
    
    auth_routes = [r for r in routes if "/auth" in r["path"]]
    
    expected_routes = [
        {"path": "/api/v1/auth/register", "methods": {"POST"}},
        {"path": "/api/v1/auth/login", "methods": {"POST"}},
        {"path": "/api/v1/auth/logout", "methods": {"POST"}},
        {"path": "/api/v1/auth/me", "methods": {"GET"}},
    ]
    
    results = []
    for expected in expected_routes:
        found = False
        for route in auth_routes:
            if route["path"] == expected["path"]:
                if expected["methods"].issubset(route["methods"]):
                    results.append({"route": expected["path"], "status": "✅ PASS", "detail": f"支持方法: {route['methods']}"})
                    found = True
                    break
        if not found:
            results.append({"route": expected["path"], "status": "❌ FAIL", "detail": "路由未找到或方法不匹配"})
    
    return results


def check_knowledge_routes(routes):
    """检查知识库路由。"""
    print("\n=== 知识库路由检查 ===")
    
    knowledge_routes = [r for r in routes if "/knowledge" in r["path"]]
    
    expected_routes = [
        {"path": "/api/v1/knowledge", "methods": {"GET", "POST"}},
        {"path": "/api/v1/knowledge/{knowledge_id}", "methods": {"GET", "PUT", "DELETE"}},
        {"path": "/api/v1/knowledge/search", "methods": {"GET"}},
    ]
    
    results = []
    for expected in expected_routes:
        found = False
        for route in knowledge_routes:
            # 处理路径参数
            route_path = route["path"].replace("{knowledge_id}", "{knowledge_id}")
            if route_path == expected["path"]:
                if expected["methods"].issubset(route["methods"]):
                    results.append({"route": expected["path"], "status": "✅ PASS", "detail": f"支持方法: {route['methods']}"})
                    found = True
                    break
        if not found:
            results.append({"route": expected["path"], "status": "❌ FAIL", "detail": "路由未找到或方法不匹配"})
    
    return results


def check_document_routes(routes):
    """检查文档路由。"""
    print("\n=== 文档路由检查 ===")
    
    document_routes = [r for r in routes if "/document" in r["path"]]
    
    expected_routes = [
        {"path": "/api/v1/documents", "methods": {"GET"}},
        {"path": "/api/v1/documents/upload", "methods": {"POST"}},
        {"path": "/api/v1/documents/{document_id}", "methods": {"GET", "DELETE"}},
    ]
    
    results = []
    for expected in expected_routes:
        found = False
        for route in document_routes:
            route_path = route["path"].replace("{document_id}", "{document_id}")
            if route_path == expected["path"]:
                if expected["methods"].issubset(route["methods"]):
                    results.append({"route": expected["path"], "status": "✅ PASS", "detail": f"支持方法: {route['methods']}"})
                    found = True
                    break
        if not found:
            results.append({"route": expected["path"], "status": "❌ FAIL", "detail": "路由未找到或方法不匹配"})
    
    return results


def check_conversation_routes(routes):
    """检查对话路由。"""
    print("\n=== 对话路由检查 ===")
    
    conversation_routes = [r for r in routes if "/conversation" in r["path"]]
    
    expected_routes = [
        {"path": "/api/v1/conversations", "methods": {"GET", "POST"}},
        {"path": "/api/v1/conversations/{conversation_id}", "methods": {"GET", "DELETE"}},
        {"path": "/api/v1/conversations/{conversation_id}/messages", "methods": {"GET", "POST"}},
    ]
    
    results = []
    for expected in expected_routes:
        found = False
        for route in conversation_routes:
            route_path = route["path"].replace("{conversation_id}", "{conversation_id}")
            if route_path == expected["path"]:
                if expected["methods"].issubset(route["methods"]):
                    results.append({"route": expected["path"], "status": "✅ PASS", "detail": f"支持方法: {route['methods']}"})
                    found = True
                    break
        if not found:
            results.append({"route": expected["path"], "status": "❌ FAIL", "detail": "路由未找到或方法不匹配"})
    
    return results


def check_chat_routes(routes):
    """检查聊天路由。"""
    print("\n=== 聊天路由检查 ===")
    
    chat_routes = [r for r in routes if "/chat" in r["path"]]
    
    expected_routes = [
        {"path": "/api/v1/chat", "methods": {"POST"}},
    ]
    
    results = []
    for expected in expected_routes:
        found = False
        for route in chat_routes:
            if route["path"] == expected["path"]:
                if expected["methods"].issubset(route["methods"]):
                    results.append({"route": expected["path"], "status": "✅ PASS", "detail": f"支持方法: {route['methods']}"})
                    found = True
                    break
        if not found:
            results.append({"route": expected["path"], "status": "❌ FAIL", "detail": "路由未找到或方法不匹配"})
    
    return results


def check_question_routes(routes):
    """检查题库路由。"""
    print("\n=== 题库路由检查 ===")
    
    question_routes = [r for r in routes if "/question" in r["path"]]
    
    expected_routes = [
        {"path": "/api/v1/questions", "methods": {"GET"}},
        {"path": "/api/v1/questions/import", "methods": {"POST"}},
        {"path": "/api/v1/questions/{question_id}", "methods": {"GET", "DELETE"}},
    ]
    
    results = []
    for expected in expected_routes:
        found = False
        for route in question_routes:
            route_path = route["path"].replace("{question_id}", "{question_id}")
            if route_path == expected["path"]:
                if expected["methods"].issubset(route["methods"]):
                    results.append({"route": expected["path"], "status": "✅ PASS", "detail": f"支持方法: {route['methods']}"})
                    found = True
                    break
        if not found:
            results.append({"route": expected["path"], "status": "❌ FAIL", "detail": "路由未找到或方法不匹配"})
    
    return results


def check_practice_routes(routes):
    """检查练习路由。"""
    print("\n=== 练习路由检查 ===")
    
    practice_routes = [r for r in routes if "/practice" in r["path"]]
    
    expected_routes = [
        {"path": "/api/v1/practice/evaluate", "methods": {"POST"}},
        {"path": "/api/v1/practice/stats", "methods": {"GET"}},
    ]
    
    results = []
    for expected in expected_routes:
        found = False
        for route in practice_routes:
            if route["path"] == expected["path"]:
                if expected["methods"].issubset(route["methods"]):
                    results.append({"route": expected["path"], "status": "✅ PASS", "detail": f"支持方法: {route['methods']}"})
                    found = True
                    break
        if not found:
            results.append({"route": expected["path"], "status": "❌ FAIL", "detail": "路由未找到或方法不匹配"})
    
    return results


def check_resume_routes(routes):
    """检查简历路由。"""
    print("\n=== 简历路由检查 ===")
    
    resume_routes = [r for r in routes if "/resume" in r["path"]]
    
    expected_routes = [
        {"path": "/api/v1/resumes", "methods": {"GET"}},
        {"path": "/api/v1/resumes/upload", "methods": {"POST"}},
        {"path": "/api/v1/resumes/{resume_id}", "methods": {"GET"}},
    ]
    
    results = []
    for expected in expected_routes:
        found = False
        for route in resume_routes:
            route_path = route["path"].replace("{resume_id}", "{resume_id}")
            if route_path == expected["path"]:
                if expected["methods"].issubset(route["methods"]):
                    results.append({"route": expected["path"], "status": "✅ PASS", "detail": f"支持方法: {route['methods']}"})
                    found = True
                    break
        if not found:
            results.append({"route": expected["path"], "status": "❌ FAIL", "detail": "路由未找到或方法不匹配"})
    
    return results


def check_health_routes(routes):
    """检查健康检查路由。"""
    print("\n=== 健康检查路由检查 ===")
    
    health_routes = [r for r in routes if "/health" in r["path"]]
    
    expected_routes = [
        {"path": "/api/v1/health", "methods": {"GET"}},
        {"path": "/api/v1/health/ready", "methods": {"GET"}},
    ]
    
    results = []
    for expected in expected_routes:
        found = False
        for route in health_routes:
            if route["path"] == expected["path"]:
                if expected["methods"].issubset(route["methods"]):
                    results.append({"route": expected["path"], "status": "✅ PASS", "detail": f"支持方法: {route['methods']}"})
                    found = True
                    break
        if not found:
            results.append({"route": expected["path"], "status": "❌ FAIL", "detail": "路由未找到或方法不匹配"})
    
    return results


def main():
    """主测试函数。"""
    print("=" * 60)
    print("API 路由完整性测试报告")
    print("=" * 60)
    
    # 获取所有路由
    routes = get_all_routes()
    
    print(f"\n总共注册的路由数量: {len(routes)}")
    print("\n路由列表:")
    for route in routes:
        methods = ", ".join(route["methods"]) if route["methods"] else "N/A"
        print(f"  {methods:10} {route['path']}")
    
    # 运行所有检查
    all_results = []
    
    all_results.extend(check_health_routes(routes))
    all_results.extend(check_auth_routes(routes))
    all_results.extend(check_knowledge_routes(routes))
    all_results.extend(check_document_routes(routes))
    all_results.extend(check_conversation_routes(routes))
    all_results.extend(check_chat_routes(routes))
    all_results.extend(check_question_routes(routes))
    all_results.extend(check_practice_routes(routes))
    all_results.extend(check_resume_routes(routes))
    
    # 统计结果
    print("\n" + "=" * 60)
    print("测试结果汇总")
    print("=" * 60)
    
    passed = sum(1 for r in all_results if "✅" in r["status"])
    failed = sum(1 for r in all_results if "❌" in r["status"])
    total = len(all_results)
    
    print(f"\n总测试数: {total}")
    print(f"通过: {passed}")
    print(f"失败: {failed}")
    print(f"通过率: {passed/total*100:.1f}%")
    
    # 显示详细结果
    print("\n详细结果:")
    for result in all_results:
        print(f"  {result['status']} {result['route']}")
        if "❌" in result["status"]:
            print(f"      原因: {result['detail']}")
    
    # 显示失败的测试
    failed_tests = [r for r in all_results if "❌" in r["status"]]
    if failed_tests:
        print("\n" + "=" * 60)
        print("失败的测试")
        print("=" * 60)
        for test in failed_tests:
            print(f"\n路由: {test['route']}")
            print(f"原因: {test['detail']}")
    
    return failed == 0


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)