"""Knowledge-scoped SQL corpus, Milvus indexing and BM25/RRF retrieval.

SQL is authoritative: disabled/deleted records never enter the returned context.
Index failures retain real keyword retrieval; subsequent requests retry indexing.
"""
import asyncio
import hashlib
import os
from collections import OrderedDict, defaultdict

from loguru import logger
from sqlalchemy import select

from app.config import get_settings
from app.core.rag.reranker import reranker
from app.core.rag.retriever import _BM25Index
from app.infrastructure.database.models import Chunk, Document, Knowledge, KnowledgeVectorIndex, Question
from app.infrastructure.database.session import get_session_context
from app.infrastructure.vectordb.milvus_client import MilvusManager
from app.models.schemas import RetrievalResult

# 精排前多召回的倍数：召回宁多勿漏，精排负责把真正相关的挑到前面
RECALL_MULTIPLIER = 4

# RRF 平滑常数（Cormack 等 2009 年提出 RRF 时的经验取值）
RRF_K = 60
BM25_CACHE_SIZE = 32


def _rerank_enabled() -> bool:
    """精排开关，默认开启；置 0/false/no/off 可关闭。"""
    return os.getenv("RERANK_ENABLED", "1").strip().lower() not in {"0", "false", "no", "off"}


class RetrievalService:
    def __init__(self):
        self._model = None
        self._model_lock = asyncio.Lock()
        self._manager = None
        self._locks = defaultdict(asyncio.Lock)
        self._indexed = {}
        self._bm25_cache = OrderedDict()
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
            questions = (await session.scalars(select(Question).where(
                Question.knowledge_id == knowledge_id, Question.deleted_at.is_(None),
            ))).all()
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
            # 在外部写入前持久化集合名；即使写入失败，整库删除仍知道要清理它。
            async with get_session_context() as session:
                if not await session.scalar(select(Knowledge.id).where(
                    Knowledge.id == knowledge_id,
                ).with_for_update()):
                    raise ValueError('知识库不存在')
                if await session.get(KnowledgeVectorIndex, collection) is None:
                    session.add(KnowledgeVectorIndex(collection_name=collection, knowledge_id=knowledge_id))
                await session.commit()
            # 和整库删除采用同一行锁，防止删除完成后在另一进程重新创建集合。
            async with get_session_context() as session:
                if not await session.scalar(select(Knowledge.id).where(
                    Knowledge.id == knowledge_id,
                ).with_for_update()):
                    raise ValueError('知识库不存在')
                await manager.ensure_connection()
                for offset in range(0, len(changed), 32):
                    ids = changed[offset:offset + 32]
                    vectors = await self._embed([records[key].content for key in ids])
                    await manager.create_collection(collection, len(vectors[0]))
                    await manager.upsert(collection, vectors, [{'id': key} for key in ids])
                if removed:
                    await manager.delete(collection, removed)
                await session.commit()
        self._indexed[collection] = hashes
        self._record_index_status(records, 'indexed')

    def forget_knowledge(self, knowledge_id, document_ids=(), collections=()):
        self._bm25_cache.pop(knowledge_id, None)
        for collection in {*collections, self._collection(knowledge_id)}:
            self._indexed.pop(collection, None)
        for document_id in document_ids:
            self._document_index_status.pop(document_id, None)

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
        """混合检索：关键词 + 向量并发召回 → RRF 融合 → Cross-Encoder 精排。

        每一环都只降级、不中断：某一路召回失败就只用另一路，
        精排不可用就退回 RRF 排序，保证检索始终有结果返回。
        """
        async with self._locks[knowledge_id]:
            records = await self._corpus(knowledge_id, user_id)
            if not records:
                self._bm25_cache.pop(knowledge_id, None)
                return []

            # 召回宁多勿漏：先取回更大的候选池，由精排挑出真正相关的 top_k
            candidates = max(top_k * RECALL_MULTIPLIER, top_k)

            # 两路并发：BM25 是纯 CPU 计算放线程池，向量那一路主要是 IO 等待。
            # 串行时延迟是两者之和，并发后接近两者最大值。
            keyword_result, vector_result = await asyncio.gather(
                self._keyword_recall(query, knowledge_id, records, candidates),
                self._vector_recall(query, knowledge_id, records, candidates),
                return_exceptions=True,
            )

            keyword_ids: list[str] = []
            if isinstance(keyword_result, BaseException):
                logger.warning('关键词检索失败: {}', type(keyword_result).__name__)
            else:
                keyword_ids = keyword_result

            vector_ids: list[str] = []
            if isinstance(vector_result, BaseException):
                logger.warning('向量检索失败: {}', type(vector_result).__name__)
            else:
                vector_ids = vector_result

            if not keyword_ids and not vector_ids:
                return []

            # 倒数排名融合：只用名次，规避 BM25 分值与 L2 距离量纲不可比的问题
            scores: defaultdict[str, float] = defaultdict(float)
            for ranking in (keyword_ids, vector_ids):
                for rank, key in enumerate(dict.fromkeys(ranking), 1):
                    scores[key] += 1.0 / (RRF_K + rank)

            fused = sorted(scores, key=scores.get, reverse=True)[:candidates]
            pool = [records[key].model_copy(update={
                'score': min(1.0, scores[key] * (RRF_K + 1) / (2 if vector_ids else 1)),
                'source': 'hybrid' if vector_ids else 'keyword',
            }) for key in fused]

            return await self._rerank(query, pool, top_k)

    async def _keyword_recall(self, query, knowledge_id, records, limit):
        cached = self._bm25_cache.get(knowledge_id)

        def search():
            fingerprint = tuple(sorted(
                (key, hashlib.sha256(row.content.encode()).digest()) for key, row in records.items()
            ))
            if cached is not None and cached[0] == fingerprint:
                index = cached[1]
            else:
                index = _BM25Index()
                for key, row in records.items():
                    index.add_document(key, row.content)
            return fingerprint, index, [key for key, _ in index.search(query, limit)]

        fingerprint, index, ranking = await asyncio.to_thread(search)
        # 缓存操作留在事件循环；同库检索由 _locks 串行，线程不会并发修改索引。
        self._bm25_cache[knowledge_id] = (fingerprint, index)
        self._bm25_cache.move_to_end(knowledge_id)
        while len(self._bm25_cache) > BM25_CACHE_SIZE:
            self._bm25_cache.popitem(last=False)
        return ranking

    async def _vector_recall(self, query, knowledge_id, records, limit):
        """向量召回；失败时记录降级状态并返回空列表，不向上抛异常。"""
        try:
            await self._sync(knowledge_id, records)
            vector = (await self._embed([query]))[0]
            hits = await self._get_manager().search(self._collection(knowledge_id), vector,
                                                   top_k=limit, ids=list(records))
            return [hit['id'] for hit in hits if hit['id'] in records]
        except Exception as exc:
            self._record_index_status(records, 'keyword_only')
            logger.warning('语义检索暂不可用，本次使用知识库关键词检索: {}', type(exc).__name__)
            return []

    async def _rerank(self, query, pool, top_k):
        """Cross-Encoder 精排；未启用或推理失败时退回 RRF 顺序。"""
        if not _rerank_enabled() or len(pool) <= 1:
            return pool[:top_k]
        try:
            return await reranker.rerank(query, pool, top_k=top_k)
        except Exception as exc:
            logger.warning('精排不可用，本次退回 RRF 排序: {}', type(exc).__name__)
            return pool[:top_k]


retrieval_service = RetrievalService()
