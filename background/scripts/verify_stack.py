# -*- coding: utf-8 -*-
"""一键验证后端全栈是否真的可用。

与 ``docker compose ps`` 的区别：ps 只能看到进程活着、健康检查通过，
但看不到「应用能不能真的用上这些依赖」。本脚本从应用进程内部实际连一遍
每个依赖，并读一次业务数据，用于回答「到底有没有真的跑起来」。

用法（在 background/ 目录）：

    docker compose exec app python scripts/verify_stack.py
    # 本机直接跑：python scripts/verify_stack.py
"""

from __future__ import annotations

import asyncio
import os
import socket
import sys

# 以 `python scripts/verify_stack.py` 方式运行时，sys.path 里只有 scripts/，
# 需要把项目根目录（background/）加进来才能 import app.*
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 结果收集：(名称, 是否通过, 说明)
RESULTS: list[tuple[str, bool, str]] = []


def record(name: str, ok: bool, detail: str = "") -> None:
    RESULTS.append((name, ok, detail))
    print(f"  {'[OK]  ' if ok else '[FAIL]'} {name:<26} {detail}")


def check_tcp(name: str, host: str, port: int) -> None:
    sock = socket.socket()
    sock.settimeout(4)
    try:
        sock.connect((host, port))
        record(name, True, f"{host}:{port} 可达")
    except Exception as exc:  # noqa: BLE001
        record(name, False, f"{host}:{port} 不可达 - {exc}")
    finally:
        sock.close()


async def check_mysql() -> None:
    """连数据库并统计业务表行数。"""
    try:
        from sqlalchemy import text
        from sqlalchemy.ext.asyncio import create_async_engine

        from app.config import Settings

        engine = create_async_engine(Settings().database_url)
        async with engine.connect() as conn:
            rows = await conn.execute(
                text(
                    "select 'users' t, count(*) c from users "
                    "union all select 'knowledge_bases', count(*) from knowledge_bases "
                    "union all select 'documents', count(*) from documents "
                    "union all select 'messages', count(*) from messages "
                    "union all select 'questions', count(*) from questions"
                )
            )
            counts = {t: c for t, c in rows.fetchall()}
        await engine.dispose()
        summary = " / ".join(f"{k}={v}" for k, v in counts.items())
        record("MySQL 业务数据", True, summary)
        if counts.get("users", 0) == 0:
            record("  └ 数据是否已迁移", False, "users 为 0，数据库是空的")
        else:
            record("  └ 数据是否已迁移", True, "有数据")
    except Exception as exc:  # noqa: BLE001
        record("MySQL 业务数据", False, f"{type(exc).__name__}: {exc}")


def check_milvus() -> None:
    """连向量库并列出集合。"""
    try:
        from pymilvus import Collection, connections, utility

        connections.connect(
            alias="verify",
            host=os.getenv("MILVUS_HOST", "localhost"),
            port=os.getenv("MILVUS_PORT", "19530"),
        )
        names = utility.list_collections(using="verify")
        detail = f"{len(names)} 个集合"
        if names:
            for name in names[:3]:
                detail += f"（{name} 实体={Collection(name, using='verify').num_entities}）"
        else:
            detail += "，空 —— 首次检索前不会建索引，属正常"
        record("Milvus 向量库", True, detail)
    except Exception as exc:  # noqa: BLE001
        record("Milvus 向量库", False, f"{type(exc).__name__}: {exc}")


def check_model_cache() -> None:
    """检查向量/精排模型是否已缓存（未缓存则首次检索会现下几百 MB）。"""
    home = os.getenv("HF_HOME", os.path.expanduser("~/.cache/huggingface"))
    hub = os.path.join(home, "hub")
    if not os.path.isdir(hub):
        record("模型缓存", False, f"{hub} 不存在，首次检索会触发下载")
        return
    models = [d for d in os.listdir(hub) if d.startswith("models--")]
    size_mb = sum(
        os.path.getsize(os.path.join(root, f))
        for root, _, files in os.walk(hub)
        for f in files
    ) / 1024 / 1024
    record("模型缓存", bool(models), f"{len(models)} 个模型，约 {size_mb:.0f} MB")
    # 中文镜像必须关掉 Xet，否则下载会卡死
    xet_off = os.getenv("HF_HUB_DISABLE_XET") == "1"
    record("  └ HF_HUB_DISABLE_XET", xet_off, "已关闭" if xet_off else "未关闭，模型下载可能卡住")


def check_llm_config() -> None:
    """确认模型配置能从环境变量解析出来（不代表 Key 一定有效）。"""
    try:
        from app.infrastructure.llm.config import env_default_config

        cfg = env_default_config()
        if cfg is None:
            record("服务端模型兜底配置", False, "未配置；用户需在设置页自填")
        else:
            record("服务端模型兜底配置", True, f"model={cfg.model} base_url={cfg.base_url}")
    except Exception as exc:  # noqa: BLE001
        record("服务端模型兜底配置", False, f"{type(exc).__name__}: {exc}")


def main() -> int:
    print("=" * 68)
    print("后端全栈验证（从应用进程内部实际连接各依赖）")
    print("=" * 68)

    print("\n[1/4] 网络连通性")
    check_tcp("MySQL", os.getenv("MYSQL_HOST", "mysql"), 3306)
    check_tcp("Milvus", os.getenv("MILVUS_HOST", "milvus"), 19530)
    check_tcp("MinIO", "minio", 9000)
    check_tcp("etcd", "etcd", 2379)

    print("\n[2/4] 业务数据（MySQL）")
    asyncio.run(check_mysql())

    print("\n[3/4] 向量库（Milvus）")
    check_milvus()

    print("\n[4/4] 模型与配置")
    check_model_cache()
    check_llm_config()

    failed = [name for name, ok, _ in RESULTS if not ok]
    print("\n" + "=" * 68)
    if failed:
        print(f"结果：{len(RESULTS) - len(failed)}/{len(RESULTS)} 通过，以下有问题：")
        for name in failed:
            print(f"  - {name}")
        return 1
    print(f"结果：全部 {len(RESULTS)} 项通过，后端栈可用")
    return 0


if __name__ == "__main__":
    sys.exit(main())
