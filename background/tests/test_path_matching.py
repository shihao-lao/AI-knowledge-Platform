# -*- coding: utf-8 -*-
"""测试路径匹配。"""

import re


def test_path_matching():
    """测试路径匹配。"""
    print("Testing path matching...")
    
    # 测试用例
    test_cases = [
        ("/api/v1/knowledge", "/api/v1/knowledge", True),
        ("/api/v1/knowledge/{knowledge_id}", "/api/v1/knowledge/{knowledge_id}", True),
        ("/api/v1/knowledge/{knowledge_id}", "/api/v1/knowledge/123", True),
        ("/api/v1/knowledge/{knowledge_id}", "/api/v1/knowledge/abc-def", True),
        ("/api/v1/knowledge/{knowledge_id}", "/api/v1/knowledge/abc/def", False),
    ]
    
    for expected, route, expected_result in test_cases:
        # 将路径参数转换为正则表达式模式
        expected_pattern = re.sub(r'\{(\w+)\}', r'(?P<\1>[^/]+)', expected)
        route_pattern = re.sub(r'\{(\w+)\}', r'(?P<\1>[^/]+)', route)
        
        result = expected_pattern == route_pattern
        
        status = "PASS" if result == expected_result else "FAIL"
        print(f"{status}: {expected} vs {route} = {result} (expected {expected_result})")


if __name__ == "__main__":
    test_path_matching()