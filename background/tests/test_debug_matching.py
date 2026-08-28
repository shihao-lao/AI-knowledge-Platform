# -*- coding: utf-8 -*-
"""调试路径匹配。"""

import re


def check_route_exists(expected_path, expected_methods, route_path, route_methods):
    """检查路由是否存在。"""
    print(f"\nChecking: {expected_path} vs {route_path}")
    print(f"  Expected methods: {expected_methods}")
    print(f"  Route methods: {route_methods}")
    
    # 处理路径参数
    if "{" in expected_path or "{" in route_path:
        # 将路径参数转换为正则表达式模式
        expected_pattern = re.sub(r'\{(\w+)\}', r'(?P<\1>[^/]+)', expected_path)
        route_pattern = re.sub(r'\{(\w+)\}', r'(?P<\1>[^/]+)', route_path)
        
        print(f"  Expected pattern: {expected_pattern}")
        print(f"  Route pattern: {route_pattern}")
        
        # 比较模式
        if expected_pattern == route_pattern:
            print(f"  Patterns match!")
            if expected_methods.issubset(route_methods):
                print(f"  Methods match!")
                return True
            else:
                print(f"  Methods don't match")
        else:
            print(f"  Patterns don't match")
        
        # 也检查原始路径（如果模式相同）
        if expected_path == route_path:
            print(f"  Original paths match!")
            if expected_methods.issubset(route_methods):
                print(f"  Methods match!")
                return True
            else:
                print(f"  Methods don't match")
        else:
            print(f"  Original paths don't match")
    else:
        print(f"  No path parameters")
        if route_path == expected_path:
            print(f"  Paths match!")
            if expected_methods.issubset(route_methods):
                print(f"  Methods match!")
                return True
            else:
                print(f"  Methods don't match")
        else:
            print(f"  Paths don't match")
    
    return False


def main():
    """主函数。"""
    print("=" * 60)
    print("Debug Path Matching")
    print("=" * 60)
    
    # 测试用例
    test_cases = [
        ("/api/v1/knowledge", {"GET", "POST"}, "/api/v1/knowledge", {"GET", "POST"}),
        ("/api/v1/knowledge/{knowledge_id}", {"GET", "PUT", "DELETE"}, "/api/v1/knowledge/{knowledge_id}", {"GET", "PUT", "DELETE"}),
        ("/api/v1/document/{document_id}", {"GET", "DELETE"}, "/api/v1/document/{document_id}", {"GET", "DELETE"}),
    ]
    
    for expected_path, expected_methods, route_path, route_methods in test_cases:
        result = check_route_exists(expected_path, expected_methods, route_path, route_methods)
        print(f"  Result: {result}")


if __name__ == "__main__":
    main()