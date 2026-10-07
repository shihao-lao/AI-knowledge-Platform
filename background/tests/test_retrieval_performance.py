"""Check responsiveness and cache invalidation without model or network calls."""

import asyncio
import threading
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.core.rag.retriever import _BM25Index
from app.etl.pipeline import ETLPipeline
from app.models.schemas import RetrievalResult
from app.services.retrieval_service import BM25_CACHE_SIZE, RetrievalService


@pytest.mark.asyncio
async def test_etl_runs_parser_and_chunker_off_event_loop():
    loop_thread = threading.get_ident()
    worker_threads = []
    started, release = threading.Event(), threading.Event()

    class Parser:
        def parse_bytes(self, *args):
            worker_threads.append(threading.get_ident())
            started.set()
            release.wait(timeout=2)
            return SimpleNamespace(text='Redis', mime_type='text/plain')

    class Chunker:
        def chunk(self, text, **kwargs):
            worker_threads.append(threading.get_ident())
            return [text]

    callback = AsyncMock()
    task = asyncio.create_task(ETLPipeline(Parser(), Chunker()).run_bytes(
        b'Redis', 'a.txt', 'text/plain', on_chunks=callback,
    ))
    try:
        assert await asyncio.to_thread(started.wait, 2)
        assert not task.done(), 'The event loop must progress while the parser is blocked'
    finally:
        release.set()
        result = await task
    assert all(thread != loop_thread for thread in worker_threads)
    assert result.chunks == ['Redis']
    callback.assert_awaited_once()


@pytest.mark.asyncio
async def test_bm25_cache_reuses_and_invalidates_actual_corpus(monkeypatch):
    service = RetrievalService()
    monkeypatch.setenv('RERANK_ENABLED', '0')
    records = {'a': RetrievalResult(id='a', content='Redis cache')}
    monkeypatch.setattr(service, '_corpus', AsyncMock(side_effect=lambda *args: records.copy()))
    monkeypatch.setattr(service, '_vector_recall', AsyncMock(return_value=[]))
    assert [r.id for r in await service.retrieve('Redis', 'kb', 'owner')] == ['a']
    original = service._bm25_cache['kb'][1]
    await service.retrieve('cache', 'kb', 'owner')
    assert service._bm25_cache['kb'][1] is original
    records['a'] = RetrievalResult(id='a', content='TCP handshake')
    assert await service.retrieve('Redis', 'kb', 'owner') == []
    assert service._bm25_cache['kb'][1] is not original
    records['b'] = RetrievalResult(id='b', content='Redis cache')
    assert [r.id for r in await service.retrieve('Redis', 'kb', 'owner')] == ['b']
    del records['b']
    assert await service.retrieve('Redis', 'kb', 'owner') == []
    records.clear()
    assert await service.retrieve('Redis', 'kb', 'owner') == []
    assert 'kb' not in service._bm25_cache


@pytest.mark.asyncio
async def test_bm25_cache_is_bounded():
    service = RetrievalService()
    records = {'a': RetrievalResult(id='a', content='Redis')}
    for i in range(BM25_CACHE_SIZE + 1):
        await service._keyword_recall('Redis', str(i), records, 5)
    assert len(service._bm25_cache) == BM25_CACHE_SIZE
    assert '0' not in service._bm25_cache


def test_bm25_incremental_add_and_clear_keep_statistics_correct():
    index = _BM25Index()
    index.add_document('a', 'Redis Redis cache')
    first = index.search('Redis', 5)[0][1]
    index.add_document('b', 'TCP handshake')
    second = index.search('Redis', 5)[0][1]
    assert first != second
    index.clear()
    assert index.search('Redis', 5) == []
    index.add_document('c', 'Redis Redis cache')
    assert index.search('Redis', 5) == [('c', first)]
