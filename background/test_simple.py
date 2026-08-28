# -*- coding: utf-8 -*-
"""简单的 FastAPI 应用测试。"""

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

try:
    from app.main import app
    print("✅ FastAPI 应用导入成功")
    print(f"应用标题: {app.title}")
    print(f"路由数量: {len(app.routes)}")
    
    # 列出所有路由
    print("\n注册的路由:")
    for route in app.routes:
        if hasattr(route, "path"):
            methods = getattr(route, "methods", set())
            print(f"  {methods} {route.path}")
    
    print("\n✅ 应用启动测试通过")
except Exception as e:
    print(f"❌ 应用启动失败: {e}")
    import traceback
    traceback.print_exc()