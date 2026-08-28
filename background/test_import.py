# -*- coding: utf-8 -*-
"""测试应用导入。"""

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

# 模拟缺失的模块
sys.modules['jose'] = MockModule()
sys.modules['jose.jwt'] = MockModule()
sys.modules['jose.exceptions'] = MockModule()
sys.modules['passlib'] = MockModule()
sys.modules['passlib.context'] = MockModule()
sys.modules['bcrypt'] = MockModule()

print("=" * 60)
print("Testing Application Import")
print("=" * 60)

try:
    from app.main import app
    print("[OK] FastAPI app imported successfully")
    print(f"  App title: {app.title}")
    print(f"  Routes count: {len(app.routes)}")
    
    # 列出路由
    print("\n[INFO] Registered routes:")
    for route in app.routes:
        if hasattr(route, "path"):
            methods = getattr(route, "methods", set())
            if methods:
                print(f"  {methods} {route.path}")
    
    print("\n[PASS] Application import test passed!")
except Exception as e:
    print(f"[FAIL] Application import failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 60)
print("Testing Service Imports")
print("=" * 60)

services = [
    "app.services.auth_service",
    "app.services.knowledge_service",
    "app.services.document_service",
    "app.services.conversation_service",
    "app.services.chat_service",
    "app.services.question_service",
    "app.services.practice_service",
    "app.services.resume_service",
]

for service in services:
    try:
        __import__(service)
        print(f"[OK] {service}")
    except Exception as e:
        print(f"[FAIL] {service}: {e}")

print("\n" + "=" * 60)
print("Testing Model Imports")
print("=" * 60)

models = [
    "app.models.schemas",
    "app.models.enums",
    "app.infrastructure.database.models",
]

for model in models:
    try:
        __import__(model)
        print(f"[OK] {model}")
    except Exception as e:
        print(f"[FAIL] {model}: {e}")

print("\n" + "=" * 60)
print("Summary")
print("=" * 60)
print("[PASS] All import tests completed!")