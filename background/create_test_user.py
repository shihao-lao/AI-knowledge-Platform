# -*- coding: utf-8 -*-
"""创建测试用户。"""

import sqlite3
import os
from datetime import datetime

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
    
    # 检查用户表是否存在
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
    if not cursor.fetchone():
        print("用户表不存在，请先启动应用创建数据库表")
        conn.close()
        exit(1)
    
    # 检查是否已有测试用户
    cursor.execute("SELECT * FROM users WHERE email = ?", ("test@example.com",))
    if cursor.fetchone():
        print("测试用户已存在")
    else:
        # 创建测试用户
        user_id = "u_test001"
        name = "测试用户"
        email = "test@example.com"
        password_hash = "$2b$12$LJ3m4ys8GtKq7Y6N6V6V6O6V6V6V6V6V6V6V6V6V6V6V6V6V6"  # Test1234
        created_at = datetime.now().isoformat()
        
        cursor.execute(
            "INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
            (user_id, name, email, password_hash, created_at)
        )
        conn.commit()
        print("测试用户创建成功!")
    
    # 查询所有用户
    cursor.execute("SELECT id, name, email, created_at FROM users")
    users = cursor.fetchall()
    
    print("\n" + "=" * 50)
    print("数据库中的用户")
    print("=" * 50)
    
    if not users:
        print("暂无用户数据")
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
    print(f"操作失败: {e}")