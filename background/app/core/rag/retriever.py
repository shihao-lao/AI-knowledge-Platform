# -*- coding: utf-8 -*-
"""关键词检索：Okapi BM25 的内存索引实现。

中文不引入 jieba 等分词器，改用「单字 + 相邻 bigram」切分：专有名词
（如"三次握手"）天然成为一个 bigram，既避免了分词依赖，也免去专业术语
被通用词典切错的问题；代价是词表变大、单字噪声较多。

检索编排（向量 + 关键词双路召回、RRF 融合、精排）见
``app.services.retrieval_service.RetrievalService``。
"""

from __future__ import annotations

import math
import re
from collections import defaultdict


def _tokenize(text: str) -> list[str]:
    """英文按词切分，中文按单字 + 相邻 bigram 切分。"""
    tokens = re.findall(r"[a-z0-9_]+", text.lower())
    for run in re.findall(r"[\u4e00-\u9fff]+", text):
        tokens.extend(run)
        tokens.extend(run[i:i + 2] for i in range(len(run) - 1))
    return tokens


class _BM25Index:
    """内存 BM25（Okapi）索引，用于关键词检索。"""

    def __init__(self, k1: float = 1.5, b: float = 0.75) -> None:
        self.k1 = k1
        self.b = b
        self._doc_ids: list[str] = []
        self._documents: list[str] = []
        self._doc_freqs: list[dict[str, int]] = []
        self._doc_lens: list[int] = []
        self._avgdl: float = 0.0
        self._df: defaultdict[str, int] = defaultdict(int)
        self._N: int = 0
        self._idf: dict[str, float] = {}
        self._total_tokens = 0
        self._dirty = False

    def clear(self) -> None:
        """清空索引。"""
        self._doc_ids.clear()
        self._documents.clear()
        self._doc_freqs.clear()
        self._doc_lens.clear()
        self._avgdl = 0.0
        self._df.clear()
        self._N = 0
        self._idf.clear()
        self._total_tokens = 0
        self._dirty = False

    def add_document(self, doc_id: str, text: str) -> None:
        """添加文档并更新统计量。"""
        tokens = _tokenize(text)
        tf: defaultdict[str, int] = defaultdict(int)
        for t in tokens:
            tf[t] += 1
        for t in tf:
            self._df[t] += 1
        self._doc_ids.append(doc_id)
        self._documents.append(text)
        self._doc_freqs.append(dict(tf))
        self._doc_lens.append(len(tokens))
        self._N += 1
        self._total_tokens += len(tokens)
        self._avgdl = self._total_tokens / self._N
        self._dirty = True

    def search(self, query: str, top_k: int) -> list[tuple[str, float]]:
        """返回 (doc_id, bm25_score) 降序。"""
        if self._N == 0:
            return []
        # 一批文档全部加入后再计算 IDF，避免逐条重算整个词表。
        if self._dirty:
            self._idf = {
                term: math.log(1.0 + (self._N - df + 0.5) / (df + 0.5))
                for term, df in self._df.items()
            }
            self._dirty = False
        q_terms = _tokenize(query)
        if not q_terms:
            return []
        scores: dict[str, float] = {}
        for i, doc_id in enumerate(self._doc_ids):
            tf = self._doc_freqs[i]
            dl = self._doc_lens[i]
            s = 0.0
            for term in q_terms:
                if term not in tf:
                    continue
                idf = self._idf.get(term, 0.0)
                f = tf[term]
                denom = f + self.k1 * (1 - self.b + self.b * dl / (self._avgdl or 1.0))
                s += idf * (f * (self.k1 + 1)) / denom
            if s > 0:
                scores[doc_id] = s
        ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:top_k]
        return ranked
