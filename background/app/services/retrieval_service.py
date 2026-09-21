"""Knowledge-scoped SQL corpus, Milvus indexing and BM25/RRF retrieval.

SQL is authoritative: disabled/deleted records never enter the returned context.
Index failures retain real keyword retrieval; subsequent requests retry indexing.
"""
import asyncio
import hashlib
import os
from collections import defaultdict

from loguru import logger
from sqlalchemy import select

from app.config import get_settings
from app.core.rag.retriever import _BM25Index
from app.infrastructure.database.models import Chunk, Document, Knowledge, Question
from app.infrastructure.database.session import get_session_context
from app.infrastructure.vectordb.milvus_client import MilvusManager
from app.models.schemas import RetrievalResult


class RetrievalService:
    def __init__(self):
        self._model = None
        self._model_lock = asyncio.Lock()
        self._manager = None
        self._locks = defaultdict(asyncio.Lock)
        self._indexed = {}
        # Only report availability confirmed by this process; after restart it is unknown.
        self._document_index_status = {}
        self.model_name = os.getenv('EMBEDDING_MODEL', 'BAAI/bge-small-zh-v1.5')

    def document_index_status(self, document_id):
        return self._document_index_status.get(document_id, 'unknown')

    def _record_index_status(self, records, status):
        for row in records.values():
            if document_id := row.metadata.get('document_id'):
                self._document_index_status[document_id] = status

    def _collection(self, knowledge_id):
        digest = hashlib.sha256(f'{knowledge_id}:{self.model_name}'.encode()).hexdigest()[:32]
        return f'kb_{digest}'

    def _get_manager(self):
        if self._manager is None:
            settings = get_settings()
            credentials = {}
            if settings.milvus_user:
                credentials = {'user': settings.milvus_user, 'password': settings.milvus_password}
            self._manager = MilvusManager(host=settings.milvus_host, port=str(settings.milvus_port),
                                          timeout=10, **credentials)
        return self._manager

    async def _embed(self, texts):
        async with self._model_lock:
            if self._model is None:
                from sentence_transformers import SentenceTransformer
                self._model = await asyncio.to_thread(SentenceTransformer, self.model_name)
            values = await asyncio.to_thread(self._model.encode, texts, normalize_embeddings=True)
            return values.tolist()

    async def _corpus(self, knowledge_id, user_id):
        async with get_session_context() as session:
            if not await session.scalar(select(Knowledge.id).where(
                Knowledge.id == knowledge_id, Knowledge.user_id == user_id
            )):
                raise ValueError('知识库不存在')
            rows = (await session.execute(select(Chunk, Document).join(Document).where(
                Document.knowledge_id == knowledge_id, Document.enabled.is_(True),
                Document.parse_status.in_(['ready', 'completed'])))).all()
            questions = (await session.scalars(select(Question).where(Question.knowledge_id == knowledge_id))).all()
        records = {c.id: RetrievalResult(id=c.id, content=c.content, metadata={
            'document_id': d.id, 'filename': d.filename, 'chunk_index': c.chunk_index, 'type': 'doc',
        }) for c, d in rows}
        records.update({q.id: RetrievalResult(id=q.id, content=f'{q.question}\n{q.answer}', metadata={
            'question_id': q.id, 'filename': q.question, 'type': 'question',
        }) for q in questions})
        return records

    async def _sync(self, knowledge_id, records):
        collection = self._collection(knowledge_id)
        previous = self._indexed.get(collection, {})
        hashes = {key: hashlib.sha256(row.content.encode()).hexdigest() for key, row in records.items()}
        changed = [key for key in records if previous.get(key) != hashes[key]]
        removed = list(previous.keys() - records.keys())
        manager = self._get_manager()
        if changed or removed:
            # Check availability before potentially downloading/loading the embedding model.
            await manager.ensure_connection()
        for offset in range(0, len(changed), 32):
            ids = changed[offset:offset + 32]
            vectors = await self._embed([records[key].content for key in ids])
            await manager.create_collection(collection, len(vectors[0]))
            await manager.upsert(collection, vectors, [{'id': key} for key in ids])
        if removed:
            await manager.delete(collection, removed)
        self._indexed[collection] = hashes
        self._record_index_status(records, 'indexed')

    async def sync_knowledge(self, knowledge_id, user_id):
        async with self._locks[knowledge_id]:
            records = await self._corpus(knowledge_id, user_id)
            try:
                await self._sync(knowledge_id, records)
                return True
            except Exception as exc:
                self._record_index_status(records, 'keyword_only')
                logger.warning('向量索引暂不可用，保留关键词检索，下次请求重试: {}', type(exc).__name__)
                return False

    async def retrieve(self, query, knowledge_id, user_id, top_k=5):
        async with self._locks[knowledge_id]:
            records = await self._corpus(knowledge_id, user_id)
            if not records:
                return []
            index = _BM25Index()
            for key, row in records.items():
                index.add_document(key, row.content)
            keywords = [key for key, _ in index.search(query, top_k * 2)]
            vector_ids = []
            try:
                await self._sync(knowledge_id, records)
                vector = (await self._embed([query]))[0]
                hits = await self._get_manager().search(self._collection(knowledge_id), vector,
                                                       top_k=top_k * 2, ids=list(records))
                vector_ids = [hit['id'] for hit in hits if hit['id'] in records]
            except Exception as exc:
                self._record_index_status(records, 'keyword_only')
                logger.warning('语义检索暂不可用，本次使用知识库关键词检索: {}', type(exc).__name__)
            scores = defaultdict(float)
            for ranking in (keywords, vector_ids):
                for rank, key in enumerate(dict.fromkeys(ranking), 1):
                    scores[key] += 1 / (60 + rank)
            ranked = sorted(scores, key=scores.get, reverse=True)[:top_k]
            return [records[key].model_copy(update={
                'score': min(1.0, scores[key] * 61 / (2 if vector_ids else 1)),
                'source': 'hybrid' if vector_ids else 'keyword',
            }) for key in ranked]


retrieval_service = RetrievalService()
