"""Durable, idempotent cleanup of resources whose SQL owners have been deleted."""

import asyncio
from datetime import timedelta
from pathlib import Path

from loguru import logger
from sqlalchemy import select

from app.infrastructure.database.models import ResourceCleanupTask, _utcnow
from app.infrastructure.database.session import get_session_context
from app.services.retrieval_service import retrieval_service


async def run_cleanup_task(task_id: str) -> bool:
    async with get_session_context() as session:
        task = await session.scalar(select(ResourceCleanupTask).where(
            ResourceCleanupTask.id == task_id,
        ).with_for_update(skip_locked=True))
        if task is None:
            return False
        failures = []
        pending_files, pending_collections = [], []
        for filename in task.files:
            try:
                await asyncio.to_thread(Path(filename).unlink, missing_ok=True)
            except Exception as exc:
                pending_files.append(filename)
                failures.append(type(exc).__name__)
        for collection in task.collections:
            try:
                await asyncio.wait_for(retrieval_service._get_manager().drop_collection(collection), timeout=15)
            except Exception as exc:
                pending_collections.append(collection)
                failures.append(type(exc).__name__)
        if failures:
            task.files, task.collections = pending_files, pending_collections
            task.attempts += 1
            task.next_attempt_at = _utcnow() + timedelta(seconds=min(3600, 5 * 2 ** min(task.attempts, 10)))
            task.last_error = ', '.join(failures)[:1000]
            logger.warning('资源清理暂未完成，任务 {} 将重试: {}', task.id, task.last_error)
        else:
            await session.delete(task)
        await session.commit()
        return not failures


async def retry_cleanup_tasks() -> None:
    async with get_session_context() as session:
        ids = list((await session.scalars(select(ResourceCleanupTask.id).where(
            ResourceCleanupTask.next_attempt_at <= _utcnow(),
        ).order_by(ResourceCleanupTask.next_attempt_at).limit(10))).all())
    for task_id in ids:
        await run_cleanup_task(task_id)


async def cleanup_worker(stop: asyncio.Event) -> None:
    while not stop.is_set():
        try:
            await retry_cleanup_tasks()
        except Exception as exc:
            logger.warning('资源清理后台重试失败: {}', type(exc).__name__)
        try:
            await asyncio.wait_for(stop.wait(), timeout=30)
        except TimeoutError:
            pass
