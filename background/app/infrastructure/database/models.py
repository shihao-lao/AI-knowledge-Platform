# -*- coding: utf-8 -*-
"""SQLAlchemy ORM 模型：用户、知识库、文档、对话、题目、练习记录、简历等。"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, JSON, Boolean
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator


# MySQL 的 TEXT 上限是 65535 字节，utf8mb4 下仅约 1.6 万汉字，
# 对简历正文、文档分块这类字段不够用，统一改用 LONGTEXT；其他方言仍用标准 TEXT。
LongText = Text().with_variant(LONGTEXT(), "mysql")


def _uuid() -> str:
    return str(uuid.uuid4())


def _short_id() -> str:
    """生成短ID，类似 Prisma 的 u_xxxxxxxx 格式。"""
    return f"u_{uuid.uuid4().hex[:8]}"


def _utcnow() -> datetime:
    """获取当前 UTC 时间（替代弃用的 datetime.utcnow()）。"""
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator):
    """UTC 时间列。

    MySQL 的 DATETIME 不保存时区，直接写入带时区的值会丢掉偏移量。这里统一在
    写入前换算成 UTC 并去掉时区，读取时再补回 UTC，保证进出都是带时区的 UTC
    时间（SQLite / PostgreSQL 下同样成立）。
    """

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value
        return value.astimezone(timezone.utc).replace(tzinfo=None)

    def process_result_value(self, value: datetime | None, dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)


class Base(DeclarativeBase):
    """声明式基类。"""


class User(Base):
    """用户表：对应 Prisma 的 User 模型。"""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=_short_id)
    name: Mapped[str] = mapped_column(String(50))
    email: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime,
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
    description: Mapped[str] = mapped_column(LongText, default="")
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)  # 添加索引
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime,
        default=_utcnow,
        index=True,  # 添加索引
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime,
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
        UTCDateTime,
        default=_utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime,
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
    content: Mapped[str] = mapped_column(LongText)
    token_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime,
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
    summary: Mapped[str | None] = mapped_column(LongText, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime,
        default=_utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime,
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
    content: Mapped[str] = mapped_column(LongText)
    citations: Mapped[str] = mapped_column(LongText, default="[]")  # JSON array of citations
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime,
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
    question: Mapped[str] = mapped_column(LongText)
    answer: Mapped[str] = mapped_column(LongText)
    keywords: Mapped[str] = mapped_column(LongText, default="[]")  # JSON array string
    source: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime,
        default=_utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime,
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
    user_answer: Mapped[str] = mapped_column(LongText)
    score: Mapped[int] = mapped_column(Integer, default=0)  # 0-100
    feedback: Mapped[str] = mapped_column(LongText, default="")
    evaluated_at: Mapped[datetime] = mapped_column(
        UTCDateTime,
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
    content: Mapped[str] = mapped_column(LongText)  # 原始解析文本（截取前 8000 字符送 LLM）
    analysis: Mapped[str] = mapped_column(LongText)  # AI 分析报告（Markdown）
    score: Mapped[int] = mapped_column(Integer, default=0)  # 0-100 整体评分
    structured: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)  # 结构化简历模块
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime,
        default=_utcnow,
    )

    # 关系
    user: Mapped["User"] = relationship(back_populates="resumes")

    # 索引
    __table_args__ = (
        {"comment": "简历分析记录：上传简历 → 解析内容 → AI 分析报告"},
    )


class UserLLMConfig(Base):
    """用户级大模型配置。

    每个用户可以接入任意 OpenAI 兼容服务（官方、中转、本地 Ollama 等），
    留空时回落到服务端 .env 中的默认配置。user_id 即主键，一个用户一份配置。
    """

    __tablename__ = "user_llm_configs"
    __table_args__ = (
        {"comment": "用户大模型配置：Base URL、API Key、模型名与请求参数"},
    )

    user_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    provider: Mapped[str] = mapped_column(String(50), default="custom")  # 展示用：openai/deepseek/ollama...
    base_url: Mapped[str] = mapped_column(String(500), default="")
    api_key: Mapped[str] = mapped_column(String(500), default="")
    model: Mapped[str] = mapped_column(String(200), default="")
    temperature: Mapped[float] = mapped_column(Float, default=0.7)
    max_tokens: Mapped[int] = mapped_column(Integer, default=2048)
    timeout: Mapped[int] = mapped_column(Integer, default=60)  # 单次请求超时（秒）
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime,
        default=_utcnow,
        onupdate=_utcnow,
    )
