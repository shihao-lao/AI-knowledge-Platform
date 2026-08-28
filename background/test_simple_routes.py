# -*- coding: utf-8 -*-
"""简单测试路由注册。"""

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
print("简单测试路由注册")
print("="*60 + "\n")

# 直接测试 create_app 函数
try:
    from app.main import create_app
    app = create_app()
    
    print(f"应用创建成功")
    print(f"路由总数: {len(app.routes)}")
    
    # 列出所有路由
    print("\n所有路由:")
    for route in app.routes:
        if hasattr(route, 'path'):
            methods = getattr(route, 'methods', set())
            if methods:
                print(f"  {methods} {route.path}")
    
    # 检查是否有 /api/v1/ 前缀的路由
    api_routes = [r for r in app.routes if hasattr(r, 'path') and '/api/v1/' in r.path]
    print(f"\nAPI 路由数量: {len(api_routes)}")
    
    if len(api_routes) == 0:
        print("\n[问题] 没有找到 API 路由！")
        print("可能原因:")
        print("1. 路由模块导入失败")
        print("2. settings.api_prefix 配置错误")
        print("3. 路由注册代码未执行")
        
        # 检查配置
        from app.config import get_settings
        settings = get_settings()
        print(f"\n当前配置:")
        print(f"  api_prefix: {settings.api_prefix}")
        
except Exception as e:
    print(f"应用创建失败: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*60)
print("测试完成")
print("="*60)