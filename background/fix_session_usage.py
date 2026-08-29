# -*- coding: utf-8 -*-
"""修复服务文件中的数据库会话使用问题。"""

import os
import re

# 需要修复的文件列表
service_files = [
    "app/services/knowledge_service.py",
    "app/services/document_service.py",
    "app/services/conversation_service.py",
    "app/services/chat_service.py",
    "app/services/question_service.py",
    "app/services/practice_service.py",
    "app/services/resume_service.py",
]

# 修复模式：将 async with get_async_session() 改为 async with get_session_context()
pattern = r'async with get_async_session\(\) as session:'
replacement = 'async with get_session_context() as session:'

for file_path in service_files:
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 替换所有匹配项
        new_content = re.sub(pattern, replacement, content)
        
        # 添加导入
        if 'from app.infrastructure.database.session import' in new_content:
            # 检查是否已经导入 get_session_context
            if 'get_session_context' not in new_content:
                # 添加到导入列表
                new_content = new_content.replace(
                    'from app.infrastructure.database.session import get_async_session',
                    'from app.infrastructure.database.session import get_async_session, get_session_context'
                )
        else:
            # 添加新的导入行
            lines = new_content.split('\n')
            for i, line in enumerate(lines):
                if 'from app.infrastructure.database.session import' in line:
                    if 'get_session_context' not in line:
                        lines[i] = line.replace(
                            'get_async_session',
                            'get_async_session, get_session_context'
                        )
                    break
            new_content = '\n'.join(lines)
        
        # 写回文件
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        print(f"Fixed: {file_path}")
    else:
        print(f"File not found: {file_path}")
    "app/services/conversation_service.py",
    "app/services/chat_service.py",
    "app/services/question_service.py",
    "app/services/practice_service.py",
    "app/services/resume_service.py",
]

# 修复模式：将 async for session in get_async_session(): 改为 async with get_async_session() as session:
pattern = r'async for session in get_async_session\(\):'
replacement = 'async with get_async_session() as session:'

for file_path in service_files:
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 替换所有匹配项
        new_content = re.sub(pattern, replacement, content)
        
        # 写回文件
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        print(f"Fixed: {file_path}")
    else:
        print(f"File not found: {file_path}")