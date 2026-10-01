# -*- coding: utf-8 -*-
"""Cross-Encoder 精排模块。

召回阶段（向量 + BM25）用的是双塔/词频模型，query 与文档各自独立编码，
无法建模细粒度交互；精排阶段用 Cross-Encoder 把 (query, 文档) 拼接后一起
过模型，相关性判断显著更准，代价是每个候选都要一次前向推理。

因此典型用法是「多召回、少精排」：召回阶段取回 4 倍候选，精排后截断到 top_k。
"""

from __future__ import annotations

import asyncio
import math
import os
import threading
from typing import Any

from loguru import logger

from app.models.schemas import RetrievalResult

# 中文检索场景默认用 BGE 系列精排模型，与项目使用的 bge 向量模型同源
DEFAULT_MODEL = "BAAI/bge-reranker-base"


class Reranker:
    """重排序器：使用 Cross-Encoder 对候选文档按与 query 的相关性重排。"""

    def __init__(
        self,
        model_name: str | None = None,
        device: str | None = None,
        max_length: int = 512,
        batch_size: int = 16,
    ) -> None:
        """
        :param model_name: CrossEncoder 模型名或本地路径，缺省读 ``RERANK_MODEL`` 环境变量
        :param device: 如 cuda / cpu / mps，None 表示由库自动选择
        :param max_length: 拼接后序列的最大长度（BGE 精排模型上限 512）
        :param batch_size: 推理批大小
        """
        self._model_name = model_name or os.getenv("RERANK_MODEL", DEFAULT_MODEL)
        self._device = device or os.getenv("RERANK_DEVICE") or None
        self._max_length = max_length
        self._batch_size = batch_size
        self._model: Any = None
        # CrossEncoder 加载很慢且占内存，用锁保证并发首次请求只加载一次
        self._load_lock = threading.Lock()

    @property
    def model_name(self) -> str:
        return self._model_name

    def _load_model(self) -> Any:
        """懒加载 CrossEncoder（线程安全）。"""
        if self._model is not None:
            return self._model
        with self._load_lock:
            if self._model is not None:
                return self._model
            try:
                from sentence_transformers import CrossEncoder
            except ImportError as e:  # pragma: no cover - 依赖缺失时给出明确指引
                raise RuntimeError("请安装 sentence-transformers 以使用 Reranker") from e
            kwargs: dict[str, Any] = {"max_length": self._max_length}
            if self._device:
                kwargs["device"] = self._device
            logger.info("加载精排模型 {}", self._model_name)
            self._model = CrossEncoder(self._model_name, **kwargs)
            logger.info("精排模型就绪: {}", self._model_name)
        return self._model

    @staticmethod
    def _to_probability(scores: list[float]) -> list[float]:
        """归一化到 0~1，供引用置信度展示。

        BGE 系列精排模型的 logit 视配置可能已由 CrossEncoder 套用 sigmoid，
        也可能仍是原始 logit。这里按取值区间判断：已落在 [0,1] 就直接用，
        否则做 sigmoid，避免把 -7.3 这种原始分数当成"置信度"显示给用户。
        """
        if scores and all(0.0 <= s <= 1.0 for s in scores):
            return scores
        return [1.0 / (1.0 + math.exp(-s)) for s in scores]

    async def rerank(
        self,
        query: str,
        documents: list[RetrievalResult],
        top_k: int = 5,
    ) -> list[RetrievalResult]:
        """按与 query 的相关性重排候选文档，返回前 top_k 条。

        ``score`` 写归一化后的 0~1 相关度（引用卡片用作置信度），
        原始分数保留在 ``metadata['rerank_score']``。
        """
        if not documents or top_k <= 0:
            return []

        def _sync_predict() -> list[float]:
            model = self._load_model()
            pairs = [(query, d.content) for d in documents]
            raw = model.predict(pairs, batch_size=self._batch_size)
            values = raw.tolist() if hasattr(raw, "tolist") else list(raw)
            return [float(v) for v in values]

        try:
            scores = await asyncio.to_thread(_sync_predict)
        except Exception as e:
            logger.exception("CrossEncoder 推理失败: {}", e)
            raise RuntimeError(f"重排序失败: {e}") from e

        if len(scores) != len(documents):
            raise RuntimeError("重排序分数数量与文档数量不一致")

        probabilities = self._to_probability(scores)
        ranked = sorted(
            zip(documents, scores, probabilities, strict=True),
            key=lambda item: item[1],
            reverse=True,
        )

        out: list[RetrievalResult] = []
        for rank, (doc, raw_score, prob) in enumerate(ranked[:top_k], start=1):
            new_doc = doc.model_copy(deep=True)
            new_doc.score = prob
            new_doc.metadata = {
                **new_doc.metadata,
                "rerank_score": raw_score,
                "rerank_rank": rank,
            }
            new_doc.source = "rerank"
            out.append(new_doc)
        return out


# 全局实例：模型懒加载，进程内复用
reranker = Reranker()
