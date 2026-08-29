# -*- coding: utf-8 -*-
"""测试应用启动。"""

import sys
import os

# 添加当前目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_import():
    """测试导入。"""
    try:
        print("测试导入 FastAPI 应用...")
        from app.main import app
        print("[OK] FastAPI 应用导入成功")
        
        print(f"\n应用标题: {app.title}")
        print(f"路由数量: {len(app.routes)}")
        
        print("\n注册的路由:")
        for route in app.routes:
            if hasattr(route, "path"):
                methods = getattr(route, "methods", set())
                print(f"  {methods} {route.path}")
        
        return True
    except Exception as e:
        print(f"[ERROR] 导入失败: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("=" * 50)
    print("  测试 FastAPI 应用启动")
    print("=" * 50)
    
    success = test_import()
    
    print("\n" + "=" * 50)
    if success:
        print("[OK] 测试通过！应用可以正常启动。")
        print("\n启动命令:")
        print("  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000")
    else:
        print("[ERROR] 测试失败！请检查错误信息。")
    print("=" * 50)