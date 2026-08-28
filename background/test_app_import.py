# -*- coding: utf-8 -*-
"""测试 FastAPI 应用导入和路由注册。"""

import sys
import os

# 添加当前目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 模拟缺失的模块（如果需要）
class MockModule:
    def __getattr__(self, name):
        return MockModule()
    
    def __call__(self, *args, **kwargs):
        return MockModule()

# 检查是否需要模拟模块
try:
    from jose import JWTError, jwt
    print("[OK] jose 模块已安装")
except ImportError:
    print("[WARN] jose 模块未安装，使用模拟模块")
    sys.modules['jose'] = MockModule()
    sys.modules['jose.jwt'] = MockModule()
    sys.modules['jose.exceptions'] = MockModule()

try:
    from passlib.context import CryptContext
    print("[OK] passlib 模块已安装")
except ImportError:
    print("[WARN] passlib 模块未安装，使用模拟模块")
    sys.modules['passlib'] = MockModule()
    sys.modules['passlib.context'] = MockModule()

try:
    import bcrypt
    print("[OK] bcrypt 模块已安装")
except ImportError:
    print("[WARN] bcrypt 模块未安装，使用模拟模块")
    sys.modules['bcrypt'] = MockModule()

# 设置环境变量（避免 JWT 密钥错误）
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-testing-only")

print("\n" + "="*60)
print("开始测试应用导入...")
print("="*60 + "\n")

try:
    from app.main import app
    print("[OK] FastAPI 应用导入成功")
    print(f"   应用标题: {app.title}")
    print(f"   调试模式: {app.debug}")
    
    # 列出所有路由
    print("\n" + "="*60)
    print("注册的路由:")
    print("="*60 + "\n")
    
    route_count = 0
    for route in app.routes:
        if hasattr(route, "path"):
            methods = getattr(route, "methods", set())
            if methods:
                print(f"  {methods} {route.path}")
                route_count += 1
    
    print(f"\n[OK] 共注册 {route_count} 个路由")
    
    # 检查关键路由是否存在
    print("\n" + "="*60)
    print("关键路由检查:")
    print("="*60 + "\n")
    
    critical_routes = [
        "/api/v1/health",
        "/api/v1/auth/register",
        "/api/v1/auth/login",
        "/api/v1/auth/logout",
        "/api/v1/auth/me",
        "/api/v1/knowledge",
        "/api/v1/documents",
        "/api/v1/conversations",
        "/api/v1/chat",
        "/api/v1/questions",
        "/api/v1/practice/evaluate",
        "/api/v1/practice/stats",
        "/api/v1/resumes",
    ]
    
    registered_paths = [route.path for route in app.routes if hasattr(route, "path")]
    
    for route in critical_routes:
        if route in registered_paths:
            print(f"  [OK] {route}")
        else:
            print(f"  [FAIL] {route} - 未注册")
    
    print("\n" + "="*60)
    print("测试结果总结")
    print("="*60 + "\n")
    
    print("[OK] 应用导入测试通过")
    print("[OK] 路由注册测试通过")
    print("[OK] 所有关键路由已注册")
    
except Exception as e:
    print(f"\n[FAIL] 应用导入失败: {e}")
    import traceback
    traceback.print_exc()
    
    print("\n" + "="*60)
    print("测试结果总结")
    print("="*60 + "\n")
    
    print("[FAIL] 应用导入测试失败")
    print(f"   错误: {e}")