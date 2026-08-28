# -*- coding: utf-8 -*-
"""测试 FastAPI 应用启动。"""

import sys
import os

# 添加当前目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

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