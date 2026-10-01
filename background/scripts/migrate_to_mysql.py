# -*- coding: utf-8 -*-
"""SQLite → MySQL 迁移：在 MySQL 建库建表、搬迁已有数据，并把 .env 切到 MySQL。

用法::

    python scripts/migrate_to_mysql.py                 # 源默认 ./dev.db，目标取 .env 的 MySQL 地址
    python scripts/migrate_to_mysql.py --source sqlite+aiosqlite:///./dev.db
    python scripts/migrate_to_mysql.py --no-switch-env # 只迁数据，不改 .env

设计要点：

* **先验证再切换**：只有 MySQL 真正连通、建库建表都成功之后才改写 ``.env``，
  避免出现「配置已指向 MySQL 但库没准备好」的坏状态。
* **幂等**：目标表已有数据时跳过该表并给出提示，不重复插入、不覆盖。
* **表顺序**：按 ``Base.metadata.sorted_tables`` 的外键拓扑序写入，避免违反约束。
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from urllib.parse import unquote, urlparse

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, func, select

from app.config import get_settings
from app.infrastructure.database.models import Base
from app.infrastructure.database.session import normalize_async_database_url, to_sync_database_url

DEFAULT_SOURCE = "sqlite+aiosqlite:///./dev.db"
DEFAULT_TARGET = "mysql+pymysql://root:root@localhost:3306/ai_knowledge_platform"
ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")


def sqlite_file_path(url: str) -> str:
    """从 SQLAlchemy SQLite URL 解析出文件路径（兼容 Windows 盘符与相对路径）。"""
    path = urlparse(url).path or ""
    if re.match(r"^/[A-Za-z]:", path):  # /C:/dir/x.db -> C:/dir/x.db
        path = path[1:]
    elif path.startswith("/"):
        path = path[1:]
    return path


def ensure_mysql_database(url: str) -> str:
    """连接 MySQL 服务器（不指定库）并创建目标数据库。"""
    import pymysql

    parsed = urlparse(url)
    db_name = (parsed.path or "").lstrip("/")
    if not db_name:
        raise RuntimeError("目标 URL 中缺少数据库名")

    conn = pymysql.connect(
        host=parsed.hostname or "localhost",
        port=parsed.port or 3306,
        user=unquote(parsed.username or "root"),
        password=unquote(parsed.password or ""),
        charset="utf8mb4",
        connect_timeout=5,
    )
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"CREATE DATABASE IF NOT EXISTS `{db_name}` "
                "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
    finally:
        conn.close()
    return db_name


def switch_env_to(target_url: str) -> None:
    """把 .env 中的 DATABASE_URL 改写为给定地址（保留其余内容与注释）。"""
    with open(ENV_PATH, encoding="utf-8") as fh:
        content = fh.read()
    replacement = f"DATABASE_URL={target_url}\n"
    if re.search(r"^DATABASE_URL=.*$", content, flags=re.MULTILINE):
        content = re.sub(r"^DATABASE_URL=.*$", replacement.rstrip("\n"), content, flags=re.MULTILINE)
    else:
        content = content.rstrip("\n") + "\n" + replacement
    with open(ENV_PATH, "w", encoding="utf-8") as fh:
        fh.write(content)
    print(f".env 已切换: DATABASE_URL={target_url}")


def main() -> int:
    parser = argparse.ArgumentParser(description="SQLite → MySQL 迁移")
    parser.add_argument("--source", default=DEFAULT_SOURCE, help="源 SQLite URL")
    parser.add_argument("--target", default=None, help="目标 MySQL URL，默认取 .env 的 MySQL 配置")
    parser.add_argument("--no-switch-env", action="store_true", help="迁移后不修改 .env")
    args = parser.parse_args()

    env_url = get_settings().database_url
    # .env 当前若是 SQLite（从 MySQL 临时切过来的场景），回退到默认 MySQL 地址作为目标
    if args.target:
        chosen_target = args.target
    elif to_sync_database_url(env_url).startswith("mysql"):
        chosen_target = env_url
    else:
        chosen_target = DEFAULT_TARGET
        print(f"[提示] .env 当前不是 MySQL，目标回退为默认地址: {DEFAULT_TARGET}")

    target_url = to_sync_database_url(chosen_target)
    source_url = to_sync_database_url(args.source)

    if not target_url.startswith("mysql"):
        print(f"[错误] 目标必须是 MySQL，当前解析为: {target_url}")
        print("       请用 --target 指定，或先把 .env 的 DATABASE_URL 改回 MySQL。")
        return 2

    # ── 1. 建库（连接不上就直接退出，不动 .env）──
    try:
        db_name = ensure_mysql_database(target_url)
    except Exception as exc:  # noqa: BLE001 - 需要把各类连接错误都友好提示
        print(f"[失败] 无法连接 MySQL: {type(exc).__name__}: {exc}")
        print()
        print("请先启动 MySQL 服务（需要管理员 PowerShell）：")
        print("    net stop MySQL80")
        print("    net start MySQL80")
        print("然后用以下命令确认 3306 已在监听：")
        print("    Test-NetConnection localhost -Port 3306")
        return 1
    print(f"数据库就绪: {db_name}")

    target = create_engine(target_url, pool_pre_ping=True)

    # ── 2. 建表 ──
    Base.metadata.create_all(target)
    print(f"表已就绪: {len(Base.metadata.tables)} 张")

    # ── 3. 搬迁数据 ──
    if not source_url.startswith("sqlite"):
        print(f"[跳过] 源 {source_url} 不是 SQLite，仅完成建库建表")
    else:
        src_file = sqlite_file_path(source_url)
        if not src_file or not os.path.exists(src_file):
            print(f"[跳过] 未找到 SQLite 文件 {src_file!r}，无数据可搬迁")
        else:
            source = create_engine(source_url)
            moved = 0
            with source.connect() as src_conn, target.begin() as dst:
                for table in Base.metadata.sorted_tables:
                    existing = dst.execute(select(func.count()).select_from(table)).scalar_one()
                    if existing:
                        print(f"  {table.name}: 目标已有 {existing} 行，跳过")
                        continue
                    rows = src_conn.execute(select(table)).mappings().all()
                    if not rows:
                        continue
                    dst.execute(table.insert(), [dict(row) for row in rows])
                    print(f"  {table.name}: 搬迁 {len(rows)} 行")
                    moved += len(rows)
            source.dispose()
            print(f"数据搬迁完成，共 {moved} 行")

    target.dispose()

    # ── 4. 全部成功后才切换 .env（写回异步驱动形式，与项目配置规范一致）──
    desired_env_url = normalize_async_database_url(target_url)
    if args.no_switch_env:
        print("[提示] 按 --no-switch-env 要求未修改 .env")
    elif env_url != desired_env_url:
        switch_env_to(desired_env_url)
    else:
        print(".env 已指向该 MySQL 地址，无需修改")

    print()
    print("完成。启动后端：")
    print("    .\\venv\\Scripts\\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8001")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
