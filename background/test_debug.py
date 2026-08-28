# -*- coding: utf-8 -*-
"""调试路由注册问题。"""

import sys
import os

# 添加当前目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 模拟缺失的模块
class MockModule:
    def __getattr__(self, name):
        return MockModule()
    
    def __call__(self, *args, **kwargs):
        return MockModule()

# 模拟所有可能缺失的模块
for mod in ['jose', 'jose.jwt', 'jose.exceptions', 'passlib', 'passlib.context', 'bcrypt']:
    if mod not in sys.modules:
        sys.modules[mod] = MockModule()

# 设置环境变量
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-testing-only")

print("="*60)
print("调试路由注册问题")
print("="*60 + "\n")

# 1. 测试单个路由模块导入
print("1. 测试单个路由模块导入:")
print("-"*60)

try:
    from app.api.routes import health
    print("[OK] health 路由模块导入成功")
    print(f"   路由数量: {len(health.router.routes)}")
    for route in health.router.routes:
        if hasattr(route, 'path'):
            print(f"   - {route.path}")
except Exception as e:
    print(f"[FAIL] health 路由模块导入失败: {e}")
    import traceback
    traceback.print_exc()

print()

try:
    from app.api.routes import auth
    print("[OK] auth 路由模块导入成功")
    print(f"   路由数量: {len(auth.router.routes)}")
    for route in auth.router.routes:
        if hasattr(route, 'path'):
            print(f"   - {route.path}")
except Exception as e:
    print(f"[FAIL] auth 路由模块导入失败: {e}")
    import traceback
    traceback.print_exc()

print()

try:
    from app.api.routes import knowledge
    print("[OK] knowledge 路由模块导入成功")
    print(f"   路由数量: {len(knowledge.router.routes)}")
    for route in knowledge.router.routes:
        if hasattr(route, 'path'):
            print(f"   - {route.path}")
except Exception as e:
    print(f"[FAIL] knowledge 路由模块导入失败: {e}")
    import traceback
    traceback.print_exc()

print()

# 2. 测试服务模块导入
print("\n2. 测试服务模块导入:")
print("-"*60)

try:
    from app.services import auth_service
    print("[OK] auth_service 模块导入成功")
except Exception as e:
    print(f"[FAIL] auth_service 模块导入失败: {e}")
    import traceback
    traceback.print_exc()

print()

try:
    from app.services import knowledge_service
    print("[OK] knowledge_service 模块导入成功")
except Exception as e:
    print(f"[FAIL] knowledge_service 模块导入失败: {e}")
    import traceback
    traceback.print_exc()

print()

# 3. 测试完整应用导入
print("\n3. 测试完整应用导入:")
print("-"*60)

try:
    from app.main import create_app
    app = create_app()
    print("[OK] 应用创建成功")
    print(f"   应用标题: {app.title}")
    print(f"   路由总数: {len(app.routes)}")
    
    # 列出所有路由
    print("\n   所有路由:")
    for route in app.routes:
        if hasattr(route, 'path'):
            methods = getattr(route, 'methods', set())
            if methods:
                print(f"     {methods} {route.path}")
    
except Exception as e:
    print(f"[FAIL] 应用创建失败: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*60)
print("调试完成")
print("="*60)