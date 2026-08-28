# -*- coding: utf-8 -*-
"""运行所有测试。"""

import subprocess
import sys


def run_tests():
    """运行所有测试。"""
    print("=" * 60)
    print("开始运行数据库配置测试")
    print("=" * 60)

    # 运行模型测试
    print("\n1. 运行模型定义测试...")
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/test_models.py", "-v"],
        capture_output=True,
        text=True
    )
    print(result.stdout)
    if result.returncode != 0:
        print(f"模型测试失败:\n{result.stderr}")

    # 运行 Alembic 配置测试
    print("\n2. 运行 Alembic 配置测试...")
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/test_alembic.py", "-v"],
        capture_output=True,
        text=True
    )
    print(result.stdout)
    if result.returncode != 0:
        print(f"Alembic 测试失败:\n{result.stderr}")

    # 运行连接测试
    print("\n3. 运行数据库连接测试...")
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/test_connection.py", "-v"],
        capture_output=True,
        text=True
    )
    print(result.stdout)
    if result.returncode != 0:
        print(f"连接测试失败:\n{result.stderr}")

    # 运行索引测试
    print("\n4. 运行索引配置测试...")
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/test_indexes.py", "-v"],
        capture_output=True,
        text=True
    )
    print(result.stdout)
    if result.returncode != 0:
        print(f"索引测试失败:\n{result.stderr}")

    print("\n" + "=" * 60)
    print("测试完成")
    print("=" * 60)


if __name__ == "__main__":
    run_tests()