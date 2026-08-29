# -*- coding: utf-8 -*-
"""快速诊断脚本 - 检查 Docker 启动状态。"""

import subprocess
import sys
import time


def run_command(cmd, description):
    """运行命令并返回结果。"""
    print(f"\n{description}...")
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            print(f"✅ 成功")
            if result.stdout:
                print(result.stdout[:500])
            return True
        else:
            print(f"❌ 失败")
            if result.stderr:
                print(result.stderr[:500])
            return False
    except subprocess.TimeoutExpired:
        print(f"⏰ 超时")
        return False
    except Exception as e:
        print(f"❌ 错误: {e}")
        return False


def main():
    """主函数。"""
    print("=" * 50)
    print("  Docker 快速诊断")
    print("=" * 50)
    
    # 检查 Docker
    if not run_command("docker info", "检查 Docker 状态"):
        print("\n❌ Docker 未运行，请启动 Docker Desktop")
        return
    
    # 检查 Docker Compose
    if not run_command("docker-compose --version", "检查 Docker Compose"):
        if not run_command("docker compose version", "检查 Docker Compose (新版本)"):
            print("\n❌ Docker Compose 未安装")
            return
    
    # 检查容器状态
    print("\n容器状态:")
    run_command("docker-compose ps", "查看容器状态")
    
    # 检查镜像
    print("\n已下载的镜像:")
    run_command("docker images | head -20", "查看镜像列表")
    
    # 检查日志
    print("\n应用日志（最后 10 行）:")
    run_command("docker-compose logs --tail=10 app", "查看应用日志")
    
    # 检查数据库日志
    print("\n数据库日志（最后 5 行）:")
    run_command("docker-compose logs --tail=5 postgres", "查看数据库日志")
    
    # 检查端口
    print("\n端口占用情况:")
    run_command("netstat -ano | findstr :8000", "检查端口 8000")
    run_command("netstat -ano | findstr :5432", "检查端口 5432")
    
    print("\n" + "=" * 50)
    print("诊断完成")
    print("=" * 50)
    
    print("\n💡 提示:")
    print("  - 如果镜像正在下载，请耐心等待")
    print("  - 查看详细日志: docker-compose logs -f app")
    print("  - 重启服务: docker-compose restart")
    print("  - 停止服务: docker-compose down")


if __name__ == "__main__":
    main()