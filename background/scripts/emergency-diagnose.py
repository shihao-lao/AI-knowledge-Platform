# -*- coding: utf-8 -*-
"""紧急诊断脚本 - 快速定位 Docker 启动问题。"""

import subprocess
import sys
import time


def run_cmd(cmd, desc, timeout=10):
    """运行命令。"""
    print(f"\n{'='*50}")
    print(f"🔍 {desc}")
    print(f"{'='*50}")
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        print(f"返回码: {result.returncode}")
        if result.stdout:
            print(f"输出:\n{result.stdout[:1000]}")
        if result.stderr:
            print(f"错误:\n{result.stderr[:1000]}")
        return result.returncode == 0
    except subprocess.TimeoutExpired:
        print(f"⏰ 命令超时（{timeout}秒）")
        return False
    except Exception as e:
        print(f"❌ 执行失败: {e}")
        return False


def main():
    """主诊断函数。"""
    print("🚨 Docker 紧急诊断")
    print(f"时间: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 1. 检查 Docker 是否运行
    print("\n" + "="*60)
    print("第一步: 检查 Docker 状态")
    print("="*60)
    
    if not run_cmd("docker info", "检查 Docker 守护进程"):
        print("\n❌ Docker 未运行！")
        print("\n解决方案:")
        print("1. 启动 Docker Desktop 应用")
        print("2. 等待 Docker 图标变为绿色")
        print("3. 重新运行此脚本")
        return
    
    # 2. 检查 Docker Compose
    print("\n" + "="*60)
    print("第二步: 检查 Docker Compose")
    print("="*60)
    
    if not run_cmd("docker-compose --version", "检查 Docker Compose"):
        if not run_cmd("docker compose version", "检查 Docker Compose (新版本)"):
            print("\n❌ Docker Compose 未安装！")
            return
    
    # 3. 检查容器状态
    print("\n" + "="*60)
    print("第三步: 检查容器状态")
    print("="*60)
    
    run_cmd("docker-compose ps", "查看所有容器状态", timeout=30)
    
    # 4. 检查镜像
    print("\n" + "="*60)
    print("第四步: 检查镜像下载情况")
    print("="*60)
    
    run_cmd("docker images", "查看已下载的镜像", timeout=30)
    
    # 5. 检查正在运行的容器
    print("\n" + "="*60)
    print("第五步: 检查正在运行的容器")
    print("="*60)
    
    run_cmd("docker ps", "查看正在运行的容器", timeout=30)
    
    # 6. 检查停止的容器
    print("\n" + "="*60)
    print("第六步: 检查停止的容器")
    print("="*60)
    
    run_cmd("docker ps -a", "查看所有容器（包括停止的）", timeout=30)
    
    # 7. 检查日志
    print("\n" + "="*60)
    print("第七步: 检查容器日志")
    print("="*60)
    
    # 获取所有容器名称
    try:
        result = subprocess.run("docker ps -a --format '{{.Names}}'", 
                              shell=True, capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            containers = result.stdout.strip().split('\n')
            for container in containers:
                if container.strip():
                    print(f"\n📋 {container} 的日志:")
                    run_cmd(f"docker logs --tail=50 {container}", f"查看 {container} 日志", timeout=15)
    except Exception as e:
        print(f"获取容器列表失败: {e}")
    
    # 8. 检查网络
    print("\n" + "="*60)
    print("第八步: 检查网络")
    print("="*60)
    
    run_cmd("docker network ls", "查看 Docker 网络", timeout=15)
    
    # 9. 检查磁盘空间
    print("\n" + "="*60)
    print("第九步: 检查磁盘空间")
    print("="*60)
    
    run_cmd("df -h", "查看磁盘空间", timeout=15)
    
    # 10. 检查内存
    print("\n" + "="*60)
    print("第十步: 检查系统资源")
    print("="*60)
    
    run_cmd("docker stats --no-stream", "查看容器资源使用", timeout=15)
    
    # 总结
    print("\n" + "="*60)
    print("📊 诊断总结")
    print("="*60)
    
    print("""
常见问题及解决方案:

1. 如果看到 "pulling" 状态:
   → 镜像正在下载，耐心等待或配置镜像源

2. 如果看到 "Exit" 状态:
   → 查看日志找出错误原因
   → 运行: docker-compose logs <服务名>

3. 如果看到 "Restarting" 状态:
   → 容器崩溃，查看日志修复问题
   → 运行: docker-compose logs <服务名>

4. 如果所有容器都是 "Up" 但无法访问:
   → 检查端口映射
   → 检查防火墙设置

5. 如果启动时间过长:
   → 可能是镜像下载慢
   → 配置国内镜像源
   → 或者使用预构建镜像

快速命令:
- 查看所有日志: docker-compose logs -f
- 重启所有服务: docker-compose restart
- 停止所有服务: docker-compose down
- 重新构建: docker-compose up -d --build
""")


if __name__ == "__main__":
    main()