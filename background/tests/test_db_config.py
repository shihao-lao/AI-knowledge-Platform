# -*- coding: utf-8 -*-
"""数据库配置测试（无 emoji）。"""

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
    print("  [OK] UUID 生成正常")

    # 测试短 ID 生成
    id1 = _short_id()
    id2 = _short_id()
    assert isinstance(id1, str)
    assert id1.startswith("u_")
    assert len(id1) == 10
    assert id1 != id2
    print("  [OK] 短 ID 生成正常")

    # 测试 UTC 时间获取
    now = _utcnow()
    from datetime import datetime, timezone
    assert isinstance(now, datetime)
    assert now.tzinfo is not None
    assert now.tzinfo == timezone.utc
    print("  [OK] UTC 时间获取正常")


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
    print("  [OK] User 模型创建正常")

    # 测试关系属性
    assert hasattr(user, 'knowledge_bases')
    assert hasattr(user, 'resumes')
    assert hasattr(user, 'practice_records')
    print("  [OK] User 关系属性正常")


def test_knowledge_model():
    """测试 Knowledge 模型。"""
    print("\n测试 Knowledge 模型...")

    knowledge = Knowledge(
        user_id="u_12345678",
        name="测试知识库",
        description="测试描述",
        status="active"
    )
    assert knowledge.user_id == "u_12345678"
    assert knowledge.name == "测试知识库"
    assert knowledge.description == "测试描述"
    assert knowledge.status == "active"
    print("  [OK] Knowledge 模型创建正常")

    # 测试关系属性
    assert hasattr(knowledge, 'user')
    assert hasattr(knowledge, 'documents')
    assert hasattr(knowledge, 'conversations')
    assert hasattr(knowledge, 'questions')
    print("  [OK] Knowledge 关系属性正常")


def test_document_model():
    """测试 Document 模型。"""
    print("\n测试 Document 模型...")

    document = Document(
        knowledge_id="u_12345678",
        filename="test.txt",
        mime_type="application/octet-stream",
        parse_status="pending",
        enabled=True
    )
    assert document.knowledge_id == "u_12345678"
    assert document.filename == "test.txt"
    assert document.mime_type == "application/octet-stream"
    assert document.parse_status == "pending"
    assert document.enabled is True
    print("  [OK] Document 模型创建正常")


def test_question_model():
    """测试 Question 模型。"""
    print("\n测试 Question 模型...")

    question = Question(
        knowledge_id="u_12345678",
        question="什么是 Python？",
        answer="Python 是一种编程语言",
        category="未分类",
        difficulty="medium",
        keywords="[]"
    )
    assert question.knowledge_id == "u_12345678"
    assert question.question == "什么是 Python？"
    assert question.answer == "Python 是一种编程语言"
    assert question.category == "未分类"
    assert question.difficulty == "medium"
    assert question.keywords == "[]"
    print("  [OK] Question 模型创建正常")


def test_indexes():
    """测试索引配置。"""
    print("\n测试索引配置...")

    # 测试 User 表索引
    user_columns = User.__table__.columns
    email_col = user_columns.get('email')
    assert email_col.unique is True
    assert email_col.index is True
    print("  [OK] User.email 唯一索引正常")

    # 测试 Knowledge 表索引
    knowledge_columns = Knowledge.__table__.columns
    assert knowledge_columns.get('user_id').index is True
    assert knowledge_columns.get('name').index is True
    assert knowledge_columns.get('status').index is True
    assert knowledge_columns.get('created_at').index is True
    print("  [OK] Knowledge 表索引正常")

    # 测试 Question 表索引
    question_columns = Question.__table__.columns
    assert question_columns.get('knowledge_id').index is True
    assert question_columns.get('category').index is True
    assert question_columns.get('difficulty').index is True
    print("  [OK] Question 表索引正常")

    # 测试外键索引
    models = [Document, Chunk, Conversation, Message, Question, PracticeRecord, Resume]
    for model in models:
        table = model.__table__
        for column in table.columns:
            if column.foreign_keys:
                assert column.index is True, \
                    f"{model.__name__}.{column.name} 是外键但没有索引"
    print("  [OK] 所有外键都有索引")


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
    print(f"  [OK] 所有 {len(expected_tables)} 个表都存在")

    # 检查表的列数
    table_info = {
        'users': 5,
        'knowledge_bases': 7,
        'documents': 12,
        'chunks': 6,
        'conversations': 7,
        'messages': 6,
        'questions': 10,
        'practice_records': 8,
        'resumes': 8,
        'trace_logs': 8,
    }

    for table_name, expected_cols in table_info.items():
        table = tables[table_name]
        actual_cols = len(table.columns)
        assert actual_cols == expected_cols, \
            f"表 {table_name} 期望 {expected_cols} 列，实际 {actual_cols} 列"
    print("  [OK] 所有表的列数正确")


def test_alembic_configuration():
    """测试 Alembic 配置。"""
    print("\n测试 Alembic 配置...")

    # 检查 alembic.ini 是否存在
    alembic_ini = os.path.exists("alembic.ini")
    assert alembic_ini, "alembic.ini 文件不存在"
    print("  [OK] alembic.ini 文件存在")

    # 检查 alembic 目录是否存在
    alembic_dir = os.path.isdir("alembic")
    assert alembic_dir, "alembic 目录不存在"
    print("  [OK] alembic 目录存在")

    # 检查 env.py 是否存在
    env_py = os.path.exists("alembic/env.py")
    assert env_py, "alembic/env.py 文件不存在"
    print("  [OK] alembic/env.py 文件存在")

    # 检查 versions 目录是否存在
    versions_dir = os.path.isdir("alembic/versions")
    assert versions_dir, "alembic/versions 目录不存在"
    print("  [OK] alembic/versions 目录存在")


def test_session_configuration():
    """测试会话配置。"""
    print("\n测试会话配置...")

    # 检查 session.py 是否存在
    session_file = os.path.exists("app/infrastructure/database/session.py")
    assert session_file, "session.py 文件不存在"
    print("  [OK] session.py 文件存在")

    # 读取 session.py 内容
    with open("app/infrastructure/database/session.py", "r", encoding="utf-8") as f:
        content = f.read()

    # 检查关键配置
    assert "pool_pre_ping" in content, "缺少 pool_pre_ping 配置"
    assert "pool_size" in content, "缺少 pool_size 配置"
    assert "max_overflow" in content, "缺少 max_overflow 配置"
    print("  [OK] 连接池配置正常")


def main():
    """运行所有测试。"""
    print("=" * 60)
    print("数据库配置测试")
    print("=" * 60)

    try:
        test_helper_functions()
        test_user_model()
        test_knowledge_model()
        test_document_model()
        test_question_model()
        test_indexes()
        test_table_structure()
        test_alembic_configuration()
        test_session_configuration()

        print("\n" + "=" * 60)
        print("[SUCCESS] 所有测试通过！")
        print("=" * 60)
        return 0
    except AssertionError as e:
        print(f"\n[FAIL] 测试失败: {e}")
        return 1
    except Exception as e:
        print(f"\n[ERROR] 测试出错: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())