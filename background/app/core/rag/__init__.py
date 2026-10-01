# -*- coding: utf-8 -*-
"""RAG 子系统：BM25 关键词检索、Cross-Encoder 精排。

检索编排（双路召回 → RRF 融合 → 精排）由
``app.services.retrieval_service.RetrievalService`` 负责，
本包只提供可复用的检索与排序组件。
"""

from app.core.rag.reranker import Reranker, reranker
from app.core.rag.retriever import _BM25Index

__all__ = ["Reranker", "reranker", "_BM25Index"]
