# -*- coding: utf-8 -*-
"""SQLAlchemy ORM 模型：用户、知识库、文档、对话、题目、练习记录、简历等。"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, JSON, Boolean
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _uuid() -> str:
    return str(uuid.uuid4())


def _short_id() -> str:
    """生成短ID，类似 Prisma 的 u_xxxxxxxx 格式。"""
    return f"u_{uuid.uuid4().hex[:8]}"


def _utcnow() -> datetime:
    """获取当前 UTC 时间（替代弃用的 datetime.utcnow()）。"""
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    """声明式基类。"""


class User(Base):
    """用户表：对应 Prisma 的 User 模型。"""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=_short_id)
    name: Mapped[str] = mapped_column(String(50))
    email: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
    )

    # 关系
    knowledge_bases: Mapped[list["Knowledge"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    resumes: Mapped[list["Resume"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    practice_records: Mapped[list["PracticeRecord"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )


class Knowledge(Base):
    """知识库表：对应 Prisma 的 Knowledge 模型。"""

    __tablename__ = "knowledge_bases"
    __table_args__ = (
        {'comment': '知识库表'},
    )

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=_short_id)
    user_id: Mapped[str] = mapped_column(String(50), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200), index=True)  # 添加索引
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)  # 添加索引
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
        index=True,  # 添加索引
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
        onupdate=_utcnow,
    )

    # 关系
    user: Mapped["User"] = relationship(back_populates="knowledge_bases")
    documents: Mapped[list["Document"]] = relationship(
        back_populates="knowledge",
        cascade="all, delete-orphan",
    )
    conversations: Mapped[list["Conversation"]] = relationship(
        back_populates="knowledge",
        cascade="all, delete-orphan",
    )
    questions: Mapped[list["Question"]] = relationship(
        back_populates="knowledge",
        cascade="all, delete-orphan",
    )


class Document(Base):
    """文档表：对应 Prisma 的 Document 模型。"""

    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=_short_id)
    knowledge_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("knowledge_bases.id", ondelete="CASCADE"),
        index=True,
    )
    filename: Mapped[str] = mapped_column(String(1024))
    filepath: Mapped[str] = mapped_column(String(2048), default="")
    mime_type: Mapped[str] = mapped_column(String(256), default="application/octet-stream")
    size: Mapped[int] = mapped_column(Integer, default=0)
    parse_status: Mapped[str] = mapped_column(String(64), default="pending")
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    char_count: Mapped[int] = mapped_column(Integer, default=0)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
        onupdate=_utcnow,
    )

    # 关系
    knowledge: Mapped["Knowledge"] = relationship(back_populates="documents")
    chunks: Mapped[list["Chunk"]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
    )


class Chunk(Base):
    """文档分块表：对应 Prisma 的 Chunk 模型。"""

    __tablename__ = "chunks"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=_short_id)
    document_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("documents.id", ondelete="CASCADE"),
        index=True,
    )
    chunk_index: Mapped[int] = mapped_column(Integer, default=0)
    content: Mapped[str] = mapped_column(Text)
    token_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
    )

    # 关系
    document: Mapped["Document"] = relationship(back_populates="chunks")


class Conversation(Base):
    """会话表：对应 Prisma 的 Conversation 模型。"""

    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=_short_id)
    knowledge_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("knowledge_bases.id", ondelete="CASCADE"),
        index=True,
    )
    title: Mapped[str] = mapped_column(String(512), default="新对话")
    message_count: Mapped[int] = mapped_column(Integer, default=0)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
        onupdate=_utcnow,
    )

    # 关系
    knowledge: Mapped["Knowledge"] = relationship(back_populates="conversations")
    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
    )


class Message(Base):
    """消息表：对应 Prisma 的 Message 模型。"""

    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=_short_id)
    conversation_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        index=True,
    )
    role: Mapped[str] = mapped_column(String(32))  # 'user' | 'assistant' | 'system'
    content: Mapped[str] = mapped_column(Text)
    citations: Mapped[str] = mapped_column(Text, default="[]")  # JSON array of citations
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
    )

    # 关系
    conversation: Mapped["Conversation"] = relationship(back_populates="messages")


class Question(Base):
    """面试题目表：对应 Prisma 的 Question 模型。"""

    __tablename__ = "questions"
    __table_args__ = (
        # 复合索引：知识库+分类、知识库+难度
        {'comment': '面试题目卡：结构化题库单元（题目 + 参考答案 + 类目/难度/关键词）'},
    )

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=_short_id)
    knowledge_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("knowledge_bases.id", ondelete="CASCADE"),
        index=True,
    )
    category: Mapped[str] = mapped_column(String(100), default="未分类", index=True)  # 添加索引
    difficulty: Mapped[str] = mapped_column(String(20), default="medium", index=True)  # 添加索引
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    keywords: Mapped[str] = mapped_column(Text, default="[]")  # JSON array string
    source: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
        onupdate=_utcnow,
    )

    # 关系
    knowledge: Mapped["Knowledge"] = relationship(back_populates="questions")
    practice_records: Mapped[list["PracticeRecord"]] = relationship(
        back_populates="question",
        cascade="all, delete-orphan",
    )


class PracticeRecord(Base):
    """答题记录表：对应 Prisma 的 PracticeRecord 模型。"""

    __tablename__ = "practice_records"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=_short_id)
    question_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("questions.id", ondelete="CASCADE"),
        index=True,
    )
    user_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    mode: Mapped[str] = mapped_column(String(20), default="question")  # question | mock
    user_answer: Mapped[str] = mapped_column(Text)
    score: Mapped[int] = mapped_column(Integer, default=0)  # 0-100
    feedback: Mapped[str] = mapped_column(Text, default="")
    evaluated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
    )

    # 关系
    question: Mapped["Question"] = relationship(back_populates="practice_records")
    user: Mapped["User"] = relationship(back_populates="practice_records")

    # 索引
    __table_args__ = (
        {"comment": "答题记录：模拟面试 / 刷题模式的评估结果，用于掌握度统计"},
    )


class Resume(Base):
    """简历分析记录表：对应 Prisma 的 Resume 模型。"""

    __tablename__ = "resumes"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=_short_id)
    user_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    filename: Mapped[str] = mapped_column(String(500))
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    content: Mapped[str] = mapped_column(Text)  # 原始解析文本（截取前 8000 字符送 LLM）
    analysis: Mapped[str] = mapped_column(Text)  # AI 分析报告（Markdown）
    score: Mapped[int] = mapped_column(Integer, default=0)  # 0-100 整体评分
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
    )

    # 关系
    user: Mapped["User"] = relationship(back_populates="resumes")

    # 索引
    __table_args__ = (
        {"comment": "简历分析记录：上传简历 → 解析内容 → AI 分析报告"},
    )


class TraceLog(Base):
    """追踪日志表：持久化关键 Span（可与内存 Tracer 配合）。"""

    __tablename__ = "trace_logs"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=_uuid)
    trace_id: Mapped[str] = mapped_column(String(64), index=True)
    span_id: Mapped[str] = mapped_column(String(64), index=True)
    operation: Mapped[str] = mapped_column(String(256))
    payload: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
    )