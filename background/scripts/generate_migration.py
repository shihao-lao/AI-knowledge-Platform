# -*- coding: utf-8 -*-
"""生成 Alembic 迁移脚本。"""

import subprocess
import sys


def generate_migration(message: str = "initial"):
    """生成 Alembic 迁移脚本。"""
    try:
        # 生成迁移脚本
        cmd = ["alembic", "revision", "--autogenerate", "-m", message]
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            print(f"✅ 迁移脚本生成成功: {message}")
            print(result.stdout)
        else:
            print(f"❌ 迁移脚本生成失败:")
            print(result.stderr)
            return False
        
        return True
    except Exception as e:
        print(f"❌ 执行失败: {e}")
        return False


if __name__ == "__main__":
    message = sys.argv[1] if len(sys.argv) > 1 else "initial"
    generate_migration(message)