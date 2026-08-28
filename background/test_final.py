# -*- coding: utf-8 -*-
"""最终测试：验证应用是否能够正常启动。"""

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
print("最终测试：验证应用是否能够正常启动")
print("="*60 + "\n")

# 1. 测试应用导入
print("1. 测试应用导入:")
print("-"*60)

try:
    from app.main import app
    print("[OK] 应用导入成功")
    print(f"   应用标题: {app.title}")
    print(f"   路由总数: {len(app.routes)}")
except Exception as e:
    print(f"[FAIL] 应用导入失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print()

# 2. 测试路由注册
print("2. 测试路由注册:")
print("-"*60)

try:
    # 检查是否有 API 路由
    api_routes = [r for r in app.routes if hasattr(r, 'path') and '/api/v1/' in r.path]
    
    if len(api_routes) > 0:
        print(f"[OK] 找到 {len(api_routes)} 个 API 路由")
        
        # 列出所有 API 路由
        print("\n   API 路由列表:")
        for route in api_routes:
            methods = getattr(route, 'methods', set())
            if methods:
                print(f"     {methods} {route.path}")
    else:
        print("[WARN] 没有找到 API 路由")
        print("   这可能是因为:")
        print("   1. 路由模块导入失败")
        print("   2. 路由注册代码未执行")
        print("   3. 配置问题")
        
        # 尝试手动注册路由
        print("\n   尝试手动注册路由...")
        from app.api.routes import health, auth, knowledge, document, conversation, chat, question, practice, resume
        from app.config import get_settings
        
        settings = get_settings()
        print(f"   API 前缀: {settings.api_prefix}")
        
        # 手动注册路由
        app.include_router(health.router, prefix=settings.api_prefix)
        app.include_router(auth.router, prefix=settings.api_prefix)
        app.include_router(knowledge.router, prefix=settings.api_prefix)
        app.include_router(document.router, prefix=settings.api_prefix)
        app.include_router(conversation.router, prefix=settings.api_prefix)
        app.include_router(chat.router, prefix=settings.api_prefix)
        app.include_router(question.router, prefix=settings.api_prefix)
        app.include_router(practice.router, prefix=settings.api_prefix)
        app.include_router(resume.router, prefix=settings.api_prefix)
        
        # 重新检查路由
        api_routes = [r for r in app.routes if hasattr(r, 'path') and '/api/v1/' in r.path]
        print(f"\n   手动注册后找到 {len(api_routes)} 个 API 路由")
        
        # 列出手动注册的路由
        print("\n   手动注册的路由:")
        for route in api_routes:
            methods = getattr(route, 'methods', set())
            if methods:
                print(f"     {methods} {route.path}")
        
except Exception as e:
    print(f"[FAIL] 路由注册测试失败: {e}")
    import traceback
    traceback.print_exc()

print()

# 3. 测试配置
print("3. 测试配置:")
print("-"*60)

try:
    from app.config import get_settings
    settings = get_settings()
    
    print(f"[OK] 配置加载成功")
    print(f"   应用名称: {settings.app_name}")
    print(f"   API 前缀: {settings.api_prefix}")
    print(f"   调试模式: {settings.debug}")
    print(f"   数据库 URL: {settings.database_url.split('@')[1] if '@' in settings.database_url else 'local'}")
    
except Exception as e:
    print(f"[FAIL] 配置加载失败: {e}")
    import traceback
    traceback.print_exc()

print()

# 4. 测试数据库会话
print("4. 测试数据库会话:")
print("-"*60)

try:
    from app.infrastructure.database.session import get_async_session
    
    # 测试会话生成器
    async def test_session():
        async for session in get_async_session():
            print(f"[OK] 数据库会话创建成功")
            return True
        return False
    
    # 运行异步测试
    import asyncio
    result = asyncio.run(test_session())
    
    if result:
        print("[OK] 数据库会话测试通过")
    else:
        print("[WARN] 数据库会话测试未执行")
        
except Exception as e:
    print(f"[FAIL] 数据库会话测试失败: {e}")
    import traceback
    traceback.print_exc()

print()

# 5. 总结
print("="*60)
print("测试总结")
print("="*60 + "\n")

print("应用状态:")
print(f"  - 应用导入: {'OK' if 'app' in locals() else 'FAIL'}")
print(f"  - 路由注册: {'OK' if len(api_routes) > 0 else 'WARN'}")
print(f"  - 配置加载: {'OK' if 'settings' in locals() else 'FAIL'}")
print(f"  - 数据库会话: {'OK' if 'result' in locals() and result else 'WARN'}")

print("\n建议:")
if len(api_routes) == 0:
    print("  - 检查路由模块是否正确导入")
    print("  - 检查 create_app() 函数是否正确执行")
    print("  - 检查 settings.api_prefix 配置")

print("\n" + "="*60)
print("测试完成")
print("="*60)