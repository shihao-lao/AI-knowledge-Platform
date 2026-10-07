"""Deletion and retries keep working when storage services fail or models change."""

from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import select

from app.infrastructure.database.models import Document, Knowledge, KnowledgeVectorIndex, ResourceCleanupTask, _utcnow
from app.models.schemas import RetrievalResult
from app.services import knowledge_service, resource_cleanup_service
from app.services.retrieval_service import RetrievalService, retrieval_service


async def seed_document(factory, tmp_path):
    root = tmp_path / 'uploads'
    root.mkdir()
    path = root / 'document.txt'
    path.write_text('Redis')
    async with factory() as session:
        session.add(Document(id='doc', knowledge_id='kb', filename='document.txt', filepath=str(path)))
        session.add(KnowledgeVectorIndex(knowledge_id='kb', collection_name='kb_old_model'))
        await session.commit()
    return path


@pytest.mark.asyncio
async def test_delete_cleans_files_all_registered_collections_and_caches(backend_database, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    path = await seed_document(backend_database, tmp_path)
    drop = AsyncMock()
    monkeypatch.setattr(retrieval_service, '_manager', SimpleNamespace(drop_collection=drop))
    monkeypatch.setattr(retrieval_service, '_indexed', {'kb_old_model': {}})
    monkeypatch.setattr(retrieval_service, '_document_index_status', {'doc': 'indexed'})
    await retrieval_service._keyword_recall('Redis', 'kb', {'a': RetrievalResult(id='a', content='Redis')}, 5)
    assert await knowledge_service.delete_knowledge_base('kb', 'other') is False
    assert path.exists()
    drop.assert_not_awaited()
    assert await knowledge_service.delete_knowledge_base('kb', 'owner') is True
    assert not path.exists()
    assert {c.args[0] for c in drop.await_args_list} == {'kb_old_model', retrieval_service._collection('kb')}
    assert 'kb' not in retrieval_service._bm25_cache
    assert 'kb_old_model' not in retrieval_service._indexed
    assert 'doc' not in retrieval_service._document_index_status
    async with backend_database() as session:
        assert await session.get(Knowledge, 'kb') is None
        assert await session.scalar(select(ResourceCleanupTask)) is None


@pytest.mark.asyncio
async def test_failure_survives_restart_and_retries_only_remaining_resources(backend_database, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    path = await seed_document(backend_database, tmp_path)
    drop = AsyncMock(side_effect=RuntimeError('offline'))
    monkeypatch.setattr(retrieval_service, '_manager', SimpleNamespace(drop_collection=drop))
    assert await knowledge_service.delete_knowledge_base('kb', 'owner') is True
    assert not path.exists()
    async with backend_database() as session:
        task = await session.scalar(select(ResourceCleanupTask))
        assert task.attempts == 1 and task.files == []
        assert task.next_attempt_at > _utcnow()
        task.next_attempt_at = _utcnow() - timedelta(seconds=1)
        await session.commit()
    fresh_service = RetrievalService()
    fresh_drop = AsyncMock()
    fresh_service._manager = SimpleNamespace(drop_collection=fresh_drop)
    monkeypatch.setattr(resource_cleanup_service, 'retrieval_service', fresh_service)
    await resource_cleanup_service.retry_cleanup_tasks()
    assert fresh_drop.await_count == 2
    async with backend_database() as session:
        assert await session.scalar(select(ResourceCleanupTask)) is None


@pytest.mark.asyncio
async def test_collection_registry_tracks_model_switches(backend_database, monkeypatch):
    service = RetrievalService()
    service._manager = SimpleNamespace(ensure_connection=AsyncMock(), create_collection=AsyncMock(), upsert=AsyncMock())
    monkeypatch.setattr(service, '_embed', AsyncMock(return_value=[[1.0, 0.0]]))
    records = {'a': RetrievalResult(id='a', content='Redis')}
    expected = set()
    for model in ('first-model', 'second-model'):
        service.model_name = model
        expected.add(service._collection('kb'))
        await service._sync('kb', records)
    async with backend_database() as session:
        assert set((await session.scalars(select(KnowledgeVectorIndex.collection_name))).all()) == expected


@pytest.mark.asyncio
async def test_outside_upload_path_is_never_deleted(backend_database, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    outside = tmp_path / 'private.txt'
    outside.write_text('Keep me')
    async with backend_database() as session:
        session.add(Document(id='doc', knowledge_id='kb', filename='private.txt', filepath=str(outside)))
        await session.commit()
    with pytest.raises(ValueError, match='uploads'):
        await knowledge_service.delete_knowledge_base('kb', 'owner')
    assert outside.exists()
    async with backend_database() as session:
        assert await session.get(Knowledge, 'kb') is not None
