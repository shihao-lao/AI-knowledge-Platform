# -*- coding: utf-8 -*-
"""数据库模型简单测试（不需要 pytest）。"""

import sys
import os

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.infrastructure.database.models import (
    Base, User, Knowledge, Document, Chunk, Conversation, Message,
    Question, PracticeRecord, Resume, TraceLog, _utcnow, _short_id, _uuid
)


def test_helper_functions():
    """测试辅助函数。"""
    print("测试辅助函数...")

    # 测试 UUID 生成
    uuid1 = _uuid()
    uuid2 = _uuid()
    assert isinstance(uuid1, str)
    assert len(uuid1) == 36
    assert uuid1 != uuid2
    print("  ✅ UUID 生成正常")

    # 测试短 ID 生成
    id1 = _short_id()
    id2 = _short_id()
    assert isinstance(id1, str)
    assert id1.startswith("u_")
    assert len(id1) == 10
    assert id1 != id2
    print("  ✅ 短 ID 生成正常")

    # 测试 UTC 时间获取
    now = _utcnow()
    from datetime import datetime, timezone
    assert isinstance(now, datetime)
    assert now.tzinfo is not None
    assert now.tzinfo == timezone.utc
    print("  ✅ UTC 时间获取正常")


def test_user_model():
    """测试 User 模型。"""
    print("\n测试 User 模型...")

    user = User(
        name="测试用户",
        email="test@example.com",
        password_hash="hashed_password"
    )
    assert user.name == "测试用户"
    assert user.email == "test@example.com"
    assert user.password_hash == "hashed_password"
    print("  ✅ User 模型创建正常")

    # 测试关系属性
    assert hasattr(user, 'knowledge_bases')
    assert hasattr(user, 'resumes')
    assert hasattr(user, 'practice_records')
    print("  ✅ User 关系属性正常")


def test_knowledge_model():
    """测试 Knowledge 模型。"""
    print("\n测试 Knowledge 模型...")

    knowledge = Knowledge(
        user_id="u_12345678",
        name="测试知识库",
        description="测试描述"
    )
    assert knowledge.user_id == "u_12345678"
    assert knowledge.name == "测试知识库"
    assert knowledge.description == "测试描述"
    assert knowledge.status == "active"
    print("  ✅ Knowledge 模型创建正常")

    # 测试关系属性
    assert hasattr(knowledge, 'user')
    assert hasattr(knowledge, 'documents')
    assert hasattr(knowledge, 'conversations')
    assert hasattr(knowledge, 'questions')
    print("  ✅ Knowledge 关系属性正常")


def test_document_model():
    """测试 Document 模型。"""
    print("\n测试 Document 模型...")

    document = Document(
        knowledge_id="u_12345678",
        filename="test.txt"
    )
    assert document.knowledge_id == "u_12345678"
    assert document.filename == "test.txt"
    assert document.mime_type == "application/octet-stream"
    assert document.parse_status == "pending"
    assert document.enabled is True
    print("  ✅ Document 模型创建正常")


def test_question_model():
    """测试 Question 模型。"""
    print("\n测试 Question 模型...")

    question = Question(
        knowledge_id="u_12345678",
        question="什么是 Python？",
        answer="Python 是一种编程语言"
    )
    assert question.knowledge_id == "u_12345678"
    assert question.question == "什么是 Python？"
    assert question.answer == "Python 是一种编程语言"
    assert question.category == "未分类"
    assert question.difficulty == "medium"
    assert question.keywords == "[]"
    print("  ✅ Question 模型创建正常")


def test_indexes():
    """测试索引配置。"""
    print("\n测试索引配置...")

    # 测试 User 表索引
    user_columns = User.__table__.columns
    email_col = user_columns.get('email')
    assert email_col.unique is True
    assert email_col.index is True
    print("  ✅ User.email 唯一索引正常")

    # 测试 Knowledge 表索引
    knowledge_columns = Knowledge.__table__.columns
    assert knowledge_columns.get('user_id').index is True
    assert knowledge_columns.get('name').index is True
    assert knowledge_columns.get('status').index is True
    assert knowledge_columns.get('created_at').index is True
    print("  ✅ Knowledge 表索引正常")

    # 测试 Question 表索引
    question_columns = Question.__table__.columns
    assert question_columns.get('knowledge_id').index is True
    assert question_columns.get('category').index is True
    assert question_columns.get('difficulty').index is True
    print("  ✅ Question 表索引正常")

    # 测试外键索引
    models = [Document, Chunk, Conversation, Message, Question, PracticeRecord, Resume]
    for model in models:
        table = model.__table__
        for column in table.columns:
            if column.foreign_keys:
                assert column.index is True, \
                    f"{model.__name__}.{column.name} 是外键但没有索引"
    print("  ✅ 所有外键都有索引")


def test_table_structure():
    """测试表结构。"""
    print("\n测试表结构...")

    # 检查所有表是否存在
    tables = Base.metadata.tables
    expected_tables = [
        'users', 'knowledge_bases', 'documents', 'chunks',
        'conversations', 'messages', 'questions', 'practice_records',
        'resumes', 'trace_logs'
    ]

    for table_name in expected_tables:
        assert table_name in tables, f"表 {table_name} 不存在"
    print(f"  ✅ 所有 {len(expected_tables)} 个表都存在")

    # 检查表的列数
    table_info = {
        'users': 5,
        'knowledge_bases': 7,
        'documents': 11,
        'chunks': 5,
        'conversations': 6,
        'messages': 5,
        'questions': 9,
        'practice_records': 7,
        'resumes': 7,
        'trace_logs': 7,
    }

    for table_name, expected_cols in table_info.items():
        table = tables[table_name]
        actual_cols = len(table.columns)
        assert actual_cols == expected_cols, \
            f"表 {table_name} 期望 {expected_cols} 列，实际 {actual_cols} 列"
    print("  ✅ 所有表的列数正确")


def main():
    """运行所有测试。"""
    print("=" * 60)
    print("数据库模型测试")
    print("=" * 60)

    try:
        test_helper_functions()
        test_user_model()
        test_knowledge_model()
        test_document_model()
        test_question_model()
        test_indexes()
        test_table_structure()

        print("\n" + "=" * 60)
        print("✅ 所有测试通过！")
        print("=" * 60)
        return 0
    except AssertionError as e:
        print(f"\n❌ 测试失败: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ 测试出错: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())