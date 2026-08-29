# -*- coding: utf-8 -*-
"""检查数据库中的用户。"""

import sqlite3
import os

# 检查数据库文件是否存在
db_path = "app.db"
if not os.path.exists(db_path):
    print(f"数据库文件不存在: {db_path}")
    print("请先启动应用创建数据库表")
    exit(1)

try:
    # 连接数据库
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 查询用户表
    cursor.execute("SELECT id, name, email, created_at FROM users")
    users = cursor.fetchall()
    
    print("=" * 50)
    print("数据库中的用户")
    print("=" * 50)
    
    if not users:
        print("暂无用户数据")
        print("\n请先注册用户:")
        print("  curl -X POST http://localhost:8000/api/auth/register \\")
        print("    -H \"Content-Type: application/json\" \\")
        print("    -d '{\"name\":\"test\",\"email\":\"test@example.com\",\"password\":\"Test1234\"}'")
    else:
        print(f"共找到 {len(users)} 个用户:\n")
        for user in users:
            print(f"ID: {user[0]}")
            print(f"姓名: {user[1]}")
            print(f"邮箱: {user[2]}")
            print(f"创建时间: {user[3]}")
            print("-" * 30)
    
    conn.close()
    
except Exception as e:
    print(f"查询失败: {e}")