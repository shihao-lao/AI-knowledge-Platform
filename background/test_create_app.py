# -*- coding: utf-8 -*-
"""测试 create_app 函数执行。"""

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
print("测试 create_app 函数执行")
print("="*60 + "\n")

# 手动执行 create_app 函数
try:
    from app.config import get_settings
    from app.infrastructure.database.session import configure_session, init_engine
    from app.api.routes import auth, chat, conversation, document, health, knowledge, practice, question, resume
    from app.middleware.rate_limit import RateLimitMiddleware
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    import os
    
    settings = get_settings()
    print(f"配置加载成功:")
    print(f"  app_name: {settings.app_name}")
    print(f"  api_prefix: {settings.api_prefix}")
    print(f"  debug: {settings.debug}")
    
    print("\n创建 FastAPI 应用...")
    application = FastAPI(
        title=settings.app_name,
        debug=settings.debug,
    )
    
    print("注册路由...")
    application.include_router(health.router, prefix=settings.api_prefix)
    print(f"  已注册 health 路由")
    
    application.include_router(auth.router, prefix=settings.api_prefix)
    print(f"  已注册 auth 路由")
    
    application.include_router(knowledge.router, prefix=settings.api_prefix)
    print(f"  已注册 knowledge 路由")
    
    application.include_router(document.router, prefix=settings.api_prefix)
    print(f"  已注册 document 路由")
    
    application.include_router(conversation.router, prefix=settings.api_prefix)
    print(f"  已注册 conversation 路由")
    
    application.include_router(chat.router, prefix=settings.api_prefix)
    print(f"  已注册 chat 路由")
    
    application.include_router(question.router, prefix=settings.api_prefix)
    print(f"  已注册 question 路由")
    
    application.include_router(practice.router, prefix=settings.api_prefix)
    print(f"  已注册 practice 路由")
    
    application.include_router(resume.router, prefix=settings.api_prefix)
    print(f"  已注册 resume 路由")
    
    print(f"\n路由总数: {len(application.routes)}")
    
    # 列出所有路由
    print("\n所有路由:")
    for route in application.routes:
        if hasattr(route, 'path'):
            methods = getattr(route, 'methods', set())
            if methods:
                print(f"  {methods} {route.path}")
    
except Exception as e:
    print(f"测试失败: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*60)
print("测试完成")
print("="*60)