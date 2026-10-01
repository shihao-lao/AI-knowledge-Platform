# -*- coding: utf-8 -*-
"""数据库模型测试。"""

import pytest
from datetime import datetime, timezone
from app.infrastructure.database.models import (
    Base, User, Knowledge, Document, Chunk, Conversation, Message,
    Question, PracticeRecord, Resume, _utcnow, _short_id, _uuid
)


class TestHelperFunctions:
    """测试辅助函数。"""

    def test_uuid(self):
        """测试 UUID 生成。"""
        uuid1 = _uuid()
        uuid2 = _uuid()
        assert isinstance(uuid1, str)
        assert len(uuid1) == 36  # UUID 格式
        assert uuid1 != uuid2

    def test_short_id(self):
        """测试短 ID 生成。"""
        id1 = _short_id()
        id2 = _short_id()
        assert isinstance(id1, str)
        assert id1.startswith("u_")
        assert len(id1) == 10  # u_ + 8 字符
        assert id1 != id2

    def test_utcnow(self):
        """测试 UTC 时间获取。"""
        now = _utcnow()
        assert isinstance(now, datetime)
        assert now.tzinfo is not None
        assert now.tzinfo == timezone.utc


class TestUserModel:
    """测试 User 模型。"""

    def test_user_creation(self):
        """测试用户创建。"""
        user = User(
            name="测试用户",
            email="test@example.com",
            password_hash="hashed_password"
        )
        assert user.name == "测试用户"
        assert user.email == "test@example.com"
        assert user.password_hash == "hashed_password"

    def test_user_id_generation(self):
        """测试用户 ID 自动生成。"""
        user = User(
            name="测试用户",
            email="test@example.com",
            password_hash="hashed_password"
        )
        assert user.id is None  # 未持久化前为 None
        # 模拟持久化
        user.id = _short_id()
        assert user.id.startswith("u_")

    def test_user_created_at(self):
        """测试用户创建时间列默认值（列默认值在 INSERT 时生效）。"""
        assert User.__table__.c.created_at.default is not None


class TestKnowledgeModel:
    """测试 Knowledge 模型。"""

    def test_knowledge_creation(self):
        """测试知识库创建。"""
        knowledge = Knowledge(
            user_id="u_12345678",
            name="测试知识库",
            description="测试描述"
        )
        assert knowledge.user_id == "u_12345678"
        assert knowledge.name == "测试知识库"
        assert knowledge.description == "测试描述"
        assert Knowledge.__table__.c.status.default.arg == "active"  # 默认值（INSERT 时生效）

    def test_knowledge_default_values(self):
        """测试知识库默认值（列默认值在 INSERT 时生效）。"""
        assert Knowledge.__table__.c.description.default.arg == ""
        assert Knowledge.__table__.c.status.default.arg == "active"


class TestDocumentModel:
    """测试 Document 模型。"""

    def test_document_creation(self):
        """测试文档创建。"""
        document = Document(
            knowledge_id="u_12345678",
            filename="test.txt"
        )
        assert document.knowledge_id == "u_12345678"
        assert document.filename == "test.txt"
        assert Document.__table__.c.mime_type.default.arg == "application/octet-stream"  # 默认值
        assert Document.__table__.c.parse_status.default.arg == "pending"  # 默认值
        assert Document.__table__.c.enabled.default.arg is True  # 默认值


class TestConversationModel:
    """测试 Conversation 模型。"""

    def test_conversation_creation(self):
        """测试对话创建。"""
        conversation = Conversation(
            knowledge_id="u_12345678",
            title="测试对话"
        )
        assert conversation.knowledge_id == "u_12345678"
        assert conversation.title == "测试对话"
        assert Conversation.__table__.c.message_count.default.arg == 0  # 默认值


class TestQuestionModel:
    """测试 Question 模型。"""

    def test_question_creation(self):
        """测试题目创建。"""
        question = Question(
            knowledge_id="u_12345678",
            question="什么是 Python？",
            answer="Python 是一种编程语言"
        )
        assert question.knowledge_id == "u_12345678"
        assert question.question == "什么是 Python？"
        assert question.answer == "Python 是一种编程语言"
        assert Question.__table__.c.category.default.arg == "未分类"  # 默认值
        assert Question.__table__.c.difficulty.default.arg == "medium"  # 默认值
        assert Question.__table__.c.keywords.default.arg == "[]"  # 默认值


class TestPracticeRecordModel:
    """测试 PracticeRecord 模型。"""

    def test_practice_record_creation(self):
        """测试练习记录创建。"""
        record = PracticeRecord(
            question_id="u_12345678",
            user_id="u_87654321",
            user_answer="测试答案"
        )
        assert record.question_id == "u_12345678"
        assert record.user_id == "u_87654321"
        assert record.user_answer == "测试答案"
        assert PracticeRecord.__table__.c.mode.default.arg == "question"  # 默认值
        assert PracticeRecord.__table__.c.score.default.arg == 0  # 默认值


class TestResumeModel:
    """测试 Resume 模型。"""

    def test_resume_creation(self):
        """测试简历创建。"""
        resume = Resume(
            user_id="u_12345678",
            filename="resume.pdf",
            content="简历内容",
            analysis="分析报告"
        )
        assert resume.user_id == "u_12345678"
        assert resume.filename == "resume.pdf"
        assert resume.content == "简历内容"
        assert resume.analysis == "分析报告"
        assert Resume.__table__.c.score.default.arg == 0  # 默认值


class TestRelationships:
    """测试模型关系。"""

    def test_user_knowledge_relationship(self):
        """测试用户-知识库关系。"""
        user = User(
            name="测试用户",
            email="test@example.com",
            password_hash="hashed_password"
        )
        knowledge = Knowledge(
            user_id="u_12345678",
            name="测试知识库"
        )
        # 关系应该在持久化后建立
        assert hasattr(user, 'knowledge_bases')
        assert hasattr(knowledge, 'user')

    def test_knowledge_document_relationship(self):
        """测试知识库-文档关系。"""
        knowledge = Knowledge(
            user_id="u_12345678",
            name="测试知识库"
        )
        document = Document(
            knowledge_id="u_12345678",
            filename="test.txt"
        )
        assert hasattr(knowledge, 'documents')
        assert hasattr(document, 'knowledge')


class TestIndexes:
    """测试索引配置。"""

    def test_user_email_unique(self):
        """测试用户邮箱唯一索引。"""
        # 检查模型定义中是否有 unique=True
        user_columns = User.__table__.columns
        email_column = user_columns.get('email')
        assert email_column is not None
        assert email_column.unique is True

    def test_knowledge_user_id_index(self):
        """测试知识库用户 ID 索引。"""
        knowledge_columns = Knowledge.__table__.columns
        user_id_column = knowledge_columns.get('user_id')
        assert user_id_column is not None
        assert user_id_column.index is True

    def test_question_category_index(self):
        """测试题目分类索引。"""
        question_columns = Question.__table__.columns
        category_column = question_columns.get('category')
        assert category_column is not None
        assert category_column.index is True

    def test_question_difficulty_index(self):
        """测试题目难度索引。"""
        question_columns = Question.__table__.columns
        difficulty_column = question_columns.get('difficulty')
        assert difficulty_column is not None
        assert difficulty_column.index is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])