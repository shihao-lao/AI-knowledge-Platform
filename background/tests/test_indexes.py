# -*- coding: utf-8 -*-
"""索引配置测试。"""

import pytest
from app.infrastructure.database.models import (
    User, Knowledge, Document, Chunk, Conversation, Message,
    Question, PracticeRecord, Resume, TraceLog
)


class TestUserIndexes:
    """测试 User 表索引。"""

    def test_email_unique_index(self):
        """测试邮箱唯一索引。"""
        columns = User.__table__.columns
        email_col = columns.get('email')
        assert email_col is not None
        assert email_col.unique is True
        assert email_col.index is True

    def test_id_primary_key(self):
        """测试 ID 主键。"""
        columns = User.__table__.columns
        id_col = columns.get('id')
        assert id_col is not None
        assert id_col.primary_key is True


class TestKnowledgeIndexes:
    """测试 Knowledge 表索引。"""

    def test_user_id_index(self):
        """测试用户 ID 索引。"""
        columns = Knowledge.__table__.columns
        user_id_col = columns.get('user_id')
        assert user_id_col is not None
        assert user_id_col.index is True

    def test_name_index(self):
        """测试名称索引。"""
        columns = Knowledge.__table__.columns
        name_col = columns.get('name')
        assert name_col is not None
        assert name_col.index is True

    def test_status_index(self):
        """测试状态索引。"""
        columns = Knowledge.__table__.columns
        status_col = columns.get('status')
        assert status_col is not None
        assert status_col.index is True

    def test_created_at_index(self):
        """测试创建时间索引。"""
        columns = Knowledge.__table__.columns
        created_at_col = columns.get('created_at')
        assert created_at_col is not None
        assert created_at_col.index is True


class TestDocumentIndexes:
    """测试 Document 表索引。"""

    def test_knowledge_id_index(self):
        """测试知识库 ID 索引。"""
        columns = Document.__table__.columns
        knowledge_id_col = columns.get('knowledge_id')
        assert knowledge_id_col is not None
        assert knowledge_id_col.index is True


class TestChunkIndexes:
    """测试 Chunk 表索引。"""

    def test_document_id_index(self):
        """测试文档 ID 索引。"""
        columns = Chunk.__table__.columns
        document_id_col = columns.get('document_id')
        assert document_id_col is not None
        assert document_id_col.index is True


class TestConversationIndexes:
    """测试 Conversation 表索引。"""

    def test_knowledge_id_index(self):
        """测试知识库 ID 索引。"""
        columns = Conversation.__table__.columns
        knowledge_id_col = columns.get('knowledge_id')
        assert knowledge_id_col is not None
        assert knowledge_id_col.index is True


class TestMessageIndexes:
    """测试 Message 表索引。"""

    def test_conversation_id_index(self):
        """测试对话 ID 索引。"""
        columns = Message.__table__.columns
        conversation_id_col = columns.get('conversation_id')
        assert conversation_id_col is not None
        assert conversation_id_col.index is True


class TestQuestionIndexes:
    """测试 Question 表索引。"""

    def test_knowledge_id_index(self):
        """测试知识库 ID 索引。"""
        columns = Question.__table__.columns
        knowledge_id_col = columns.get('knowledge_id')
        assert knowledge_id_col is not None
        assert knowledge_id_col.index is True

    def test_category_index(self):
        """测试分类索引。"""
        columns = Question.__table__.columns
        category_col = columns.get('category')
        assert category_col is not None
        assert category_col.index is True

    def test_difficulty_index(self):
        """测试难度索引。"""
        columns = Question.__table__.columns
        difficulty_col = columns.get('difficulty')
        assert difficulty_col is not None
        assert difficulty_col.index is True


class TestPracticeRecordIndexes:
    """测试 PracticeRecord 表索引。"""

    def test_question_id_index(self):
        """测试题目 ID 索引。"""
        columns = PracticeRecord.__table__.columns
        question_id_col = columns.get('question_id')
        assert question_id_col is not None
        assert question_id_col.index is True

    def test_user_id_index(self):
        """测试用户 ID 索引。"""
        columns = PracticeRecord.__table__.columns
        user_id_col = columns.get('user_id')
        assert user_id_col is not None
        assert user_id_col.index is True


class TestResumeIndexes:
    """测试 Resume 表索引。"""

    def test_user_id_index(self):
        """测试用户 ID 索引。"""
        columns = Resume.__table__.columns
        user_id_col = columns.get('user_id')
        assert user_id_col is not None
        assert user_id_col.index is True


class TestTraceLogIndexes:
    """测试 TraceLog 表索引。"""

    def test_trace_id_index(self):
        """测试追踪 ID 索引。"""
        columns = TraceLog.__table__.columns
        trace_id_col = columns.get('trace_id')
        assert trace_id_col is not None
        assert trace_id_col.index is True

    def test_span_id_index(self):
        """测试 Span ID 索引。"""
        columns = TraceLog.__table__.columns
        span_id_col = columns.get('span_id')
        assert span_id_col is not None
        assert span_id_col.index is True


class TestIndexCompleteness:
    """测试索引完整性。"""

    def test_all_foreign_keys_indexed(self):
        """测试所有外键都有索引。"""
        models = [
            Knowledge, Document, Chunk, Conversation, Message,
            Question, PracticeRecord, Resume
        ]

        for model in models:
            table = model.__table__
            for column in table.columns:
                if column.foreign_keys:
                    assert column.index is True, \
                        f"{model.__name__}.{column.name} 是外键但没有索引"

    def test_common_query_fields_indexed(self):
        """测试常见查询字段有索引。"""
        # User.email - 登录查询
        assert User.__table__.columns.get('email').index is True

        # Knowledge.user_id - 用户知识库查询
        assert Knowledge.__table__.columns.get('user_id').index is True

        # Knowledge.status - 状态过滤
        assert Knowledge.__table__.columns.get('status').index is True

        # Question.category - 分类查询
        assert Question.__table__.columns.get('category').index is True

        # Question.difficulty - 难度查询
        assert Question.__table__.columns.get('difficulty').index is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])