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