"""A cancelled coroutine must not leave a live SDK writer behind its SQL lock."""

import asyncio
import threading
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.infrastructure.vectordb.milvus_client import _run_sync
from app.models.schemas import RetrievalResult
from app.services.knowledge_service import delete_knowledge_base
from app.services.retrieval_service import RetrievalService, retrieval_service


@pytest.mark.asyncio
async def test_cancellation_waits_for_sdk_writer_before_releasing_outer_lock():
    started, release = threading.Event(), threading.Event()
    events = []

    def sdk_write():
        started.set()
        release.wait(timeout=2)
        events.append('write_finished')

    async def locked_write():
        try:
            await _run_sync(sdk_write)
        finally:
            events.append('lock_released')

    task = asyncio.create_task(locked_write())
    try:
        assert await asyncio.to_thread(started.wait, 2)
        task.cancel()
        await asyncio.sleep(0)
        assert not task.done()
        task.cancel()  # Repeated cancellation still must not abandon the writer.
    finally:
        release.set()
        with pytest.raises(asyncio.CancelledError):
            await task
    assert events == ['write_finished', 'lock_released']


@pytest.mark.asyncio
async def test_delete_during_embedding_cannot_recreate_collection(backend_database, monkeypatch):
    started, release = asyncio.Event(), asyncio.Event()
    service = RetrievalService()
    manager = SimpleNamespace(ensure_connection=AsyncMock(), create_collection=AsyncMock(),
                              upsert=AsyncMock(), drop_collection=AsyncMock())
    service._manager = manager
    monkeypatch.setattr(retrieval_service, '_manager', manager)

    async def embed(texts):
        started.set()
        await release.wait()
        return [[1.0, 0.0]]

    monkeypatch.setattr(service, '_embed', embed)
    task = asyncio.create_task(service._sync('kb', {'a': RetrievalResult(id='a', content='Redis')}))
    try:
        await asyncio.wait_for(started.wait(), 2)
        # Deletion should acquire its SQL lock while the encoder is still blocked.
        async with asyncio.timeout(2):
            assert await delete_knowledge_base('kb', 'owner')
    finally:
        release.set()
        with pytest.raises(ValueError, match='知识库不存在'):
            await task
    manager.create_collection.assert_not_awaited()
    manager.upsert.assert_not_awaited()
