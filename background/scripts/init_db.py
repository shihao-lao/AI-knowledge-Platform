# -*- coding: utf-8 -*-
"""数据库初始化脚本：确保数据库存在，并创建全部表。

支持 MySQL（需在服务器上预建库）与 SQLite（嵌入式，文件即数据库，直接建表）。

字段变更请优先走 Alembic 迁移：

    alembic revision --autogenerate -m "描述"
    alembic upgrade head
"""

import asyncio
import os
import sys
from urllib.parse import unquote, urlparse

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import get_settings
from app.infrastructure.database.models import Base
from app.infrastructure.database.session import configure_session, init_engine


def ensure_database_exists(database_url: str) -> str:
    """确保目标数据库存在。

    MySQL 需要先连上服务器建库；SQLite 等嵌入式数据库由文件承载，无需此步。
    """
    if not database_url.startswith("mysql"):
        return "（嵌入式数据库，无需预建库）"

    import pymysql

    parsed = urlparse(database_url)
    db_name = (parsed.path or "").lstrip("/")
    if not db_name:
        raise RuntimeError("DATABASE_URL 中缺少数据库名")

    conn = pymysql.connect(
        host=parsed.hostname or "localhost",
        port=parsed.port or 3306,
        user=unquote(parsed.username or "root"),
        password=unquote(parsed.password or ""),
        charset="utf8mb4",
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


async def init_database() -> None:
    """确保数据库存在并创建所有表。"""
    settings = get_settings()
    db_name = ensure_database_exists(settings.database_url)
    print(f"数据库就绪: {db_name}")

    engine = init_engine(settings.database_url)
    configure_session(engine)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()

    tables = ", ".join(sorted(Base.metadata.tables))
    print(f"表已就绪（共 {len(Base.metadata.tables)} 张）: {tables}")


if __name__ == "__main__":
    asyncio.run(init_database())
