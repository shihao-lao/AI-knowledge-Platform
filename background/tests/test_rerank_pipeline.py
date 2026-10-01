# -*- coding: utf-8 -*-
"""检索精排链路测试。

覆盖三种状态，确保精排是"可降级的增强"而不是新的故障点：
1. 关闭精排 → 返回 RRF 顺序
2. 精排可用 → 采用精排结果
3. 精排推理失败 → 静默退回 RRF 顺序，不影响检索可用性
"""

from __future__ import annotations

import pytest

from app.core.rag.reranker import Reranker
from app.core.rag.retriever import _BM25Index
from app.models.schemas import RetrievalResult
from app.services import retrieval_service as rs


def _pool(size: int = 5) -> list[RetrievalResult]:
    """构造一个已按 RRF 分数降序排列的候选池（c0 最相关）。"""
    return [
        RetrievalResult(
            id=f"c{i}",
            content=f"候选文档 {i}",
            score=round(1.0 - i * 0.1, 2),
            metadata={"document_id": f"d{i}"},
        )
        for i in range(size)
    ]


@pytest.mark.asyncio
async def test_rerank_disabled_returns_rrf_order(monkeypatch):
    """RERANK_ENABLED=0 时应直接按 RRF 顺序截断。"""
    monkeypatch.setenv("RERANK_ENABLED", "0")
    out = await rs.retrieval_service._rerank("query", _pool(), top_k=3)
    assert [d.id for d in out] == ["c0", "c1", "c2"]


@pytest.mark.asyncio
async def test_rerank_applied_when_available(monkeypatch):
    """精排可用时，最终顺序应由精排决定而非 RRF。"""
    monkeypatch.setenv("RERANK_ENABLED", "1")

    async def fake_rerank(query, documents, top_k=5):
        ranked = list(reversed(documents))[:top_k]
        for doc in ranked:
            doc.source = "rerank"
        return ranked

    monkeypatch.setattr(rs.reranker, "rerank", fake_rerank)
    out = await rs.retrieval_service._rerank("query", _pool(), top_k=2)

    assert [d.id for d in out] == ["c4", "c3"], "应采用精排顺序而不是 RRF 顺序"
    assert all(d.source == "rerank" for d in out)


@pytest.mark.asyncio
async def test_rerank_failure_falls_back_to_rrf(monkeypatch):
    """精排抛异常时必须降级，不能让检索整体失败。"""
    monkeypatch.setenv("RERANK_ENABLED", "1")

    async def boom(query, documents, top_k=5):
        raise RuntimeError("精排模型加载失败")

    monkeypatch.setattr(rs.reranker, "rerank", boom)
    out = await rs.retrieval_service._rerank("query", _pool(), top_k=3)

    assert [d.id for d in out] == ["c0", "c1", "c2"], "失败后应退回 RRF 顺序"
    assert len(out) == 3


@pytest.mark.asyncio
async def test_rerank_skipped_for_single_candidate(monkeypatch):
    """只有一个候选时无需精排，避免无谓的模型调用。"""
    monkeypatch.setenv("RERANK_ENABLED", "1")

    async def should_not_be_called(query, documents, top_k=5):
        raise AssertionError("候选数不足时不应调用精排")

    monkeypatch.setattr(rs.reranker, "rerank", should_not_be_called)
    out = await rs.retrieval_service._rerank("query", _pool(size=1), top_k=5)

    assert [d.id for d in out] == ["c0"]


def test_probability_normalisation():
    """引用置信度必须是 0~1：原始 logit 要走 sigmoid，已是概率则原样保留。"""
    # BGE/CrossEncoder 若已套用 sigmoid，取值落在 [0,1]，不应二次变换
    assert Reranker._to_probability([0.2, 0.8]) == [0.2, 0.8]

    # 原始 logit 需压缩到 (0,1)，且保持单调
    low, high = Reranker._to_probability([-7.0, 7.0])
    assert 0.0 < low < 0.5 < high < 1.0


def test_bm25_index_still_ranks_chinese_bigram():
    """精排接入不应影响 BM25 本身：中文 bigram 仍需能命中专有名词。"""
    index = _BM25Index()
    index.add_document("hit", "TCP 三次握手：客户端发送 SYN，服务端回复 SYN+ACK")
    index.add_document("miss", "今天天气不错，适合出门散步")

    ranked = index.search("三次握手", top_k=2)

    assert ranked, "BM25 应能召回结果"
    assert ranked[0][0] == "hit"
    assert ranked[0][1] > 0
