# -*- coding: utf-8 -*-
"""测试 Pydantic 模型。"""

import sys
import os

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 设置测试环境变量（jose / bcrypt 均已安装，不需要模块替身；
# 替身会污染 sys.modules 并让其他测试拿到假的 jose）
os.environ["SECRET_KEY"] = "test-secret-key-for-testing-only"
os.environ["DATABASE_URL"] = "mysql+aiomysql://root:root@localhost:3306/ai_knowledge_platform_test"


def test_user_schemas():
    """测试用户相关模型。"""
    print("\n=== Testing User Schemas ===")
    
    try:
        from app.models.schemas import UserCreate, UserLogin, UserResponse
        
        # 测试 UserCreate
        print("\n1. UserCreate:")
        user_data = {
            "name": "Test User",
            "email": "test@example.com",
            "password": "Password123"
        }
        user = UserCreate(**user_data)
        print(f"  Created: {user}")
        print(f"  Name: {user.name}")
        print(f"  Email: {user.email}")
        
        # 测试密码验证
        print("\n2. Password validation:")
        try:
            UserCreate(name="Test", email="test@example.com", password="weak")
            print("  FAIL: Should reject weak password")
        except Exception as e:
            print(f"  PASS: Rejected weak password: {e}")
        
        # 测试 UserLogin
        print("\n3. UserLogin:")
        login_data = {
            "email": "test@example.com",
            "password": "Password123"
        }
        login = UserLogin(**login_data)
        print(f"  Created: {login}")
        
        # 测试 UserResponse
        print("\n4. UserResponse:")
        response_data = {
            "id": "u_12345678",
            "name": "Test User",
            "email": "test@example.com",
            "created_at": "2024-01-01T00:00:00"
        }
        response = UserResponse(**response_data)
        print(f"  Created: {response}")
        
        return True
    except Exception as e:
        print(f"FAIL: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_knowledge_schemas():
    """测试知识库相关模型。"""
    print("\n=== Testing Knowledge Schemas ===")
    
    try:
        from app.models.schemas import KnowledgeCreate, KnowledgeUpdate, KnowledgeResponse
        
        # 测试 KnowledgeCreate
        print("\n1. KnowledgeCreate:")
        create_data = {
            "name": "Test Knowledge Base",
            "description": "Test description"
        }
        create = KnowledgeCreate(**create_data)
        print(f"  Created: {create}")
        
        # 测试 KnowledgeUpdate
        print("\n2. KnowledgeUpdate:")
        update_data = {
            "name": "Updated Knowledge Base",
            "description": "Updated description"
        }
        update = KnowledgeUpdate(**update_data)
        print(f"  Created: {update}")
        
        # 测试 KnowledgeResponse
        print("\n3. KnowledgeResponse:")
        response_data = {
            "id": "kb_12345678",
            "name": "Test Knowledge Base",
            "description": "Test description",
            "status": "active",
            "created_at": "2024-01-01T00:00:00",
            "updated_at": "2024-01-01T00:00:00"
        }
        response = KnowledgeResponse(**response_data)
        print(f"  Created: {response}")
        
        return True
    except Exception as e:
        print(f"FAIL: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_document_schemas():
    """测试文档相关模型。"""
    print("\n=== Testing Document Schemas ===")
    
    try:
        from app.models.schemas import DocumentResponse, DocumentUploadResponse
        
        # 测试 DocumentResponse
        print("\n1. DocumentResponse:")
        response_data = {
            "id": "doc_12345678",
            "filename": "test.txt",
            "mime_type": "text/plain",
            "size": 1024,
            "parse_status": "ready",
            "chunk_count": 10,
            "char_count": 5000,
            "enabled": True,
            "created_at": "2024-01-01T00:00:00",
            "updated_at": "2024-01-01T00:00:00"
        }
        response = DocumentResponse(**response_data)
        print(f"  Created: {response}")
        
        # 测试 DocumentUploadResponse
        print("\n2. DocumentUploadResponse:")
        upload_response_data = {
            "document_id": "doc_12345678",
            "filename": "test.txt",
            "status": "ready",
            "chunk_count": 10,
            "message": "ok"
        }
        upload_response = DocumentUploadResponse(**upload_response_data)
        print(f"  Created: {upload_response}")
        
        return True
    except Exception as e:
        print(f"FAIL: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_question_schemas():
    """测试题目相关模型。"""
    print("\n=== Testing Question Schemas ===")
    
    try:
        from app.models.schemas import QuestionCreate, QuestionResponse, QuestionImportRequest
        
        # 测试 QuestionCreate
        print("\n1. QuestionCreate:")
        create_data = {
            "category": "技术",
            "difficulty": "medium",
            "question": "什么是 Python？",
            "answer": "Python 是一种编程语言",
            "keywords": ["Python", "编程"],
            "source": "test"
        }
        create = QuestionCreate(**create_data)
        print(f"  Created: {create}")
        
        # 测试 QuestionResponse
        print("\n2. QuestionResponse:")
        response_data = {
            "id": "q_12345678",
            "category": "技术",
            "difficulty": "medium",
            "question": "什么是 Python？",
            "answer": "Python 是一种编程语言",
            "keywords": ["Python", "编程"],
            "source": "test",
            "created_at": "2024-01-01T00:00:00",
            "updated_at": "2024-01-01T00:00:00"
        }
        response = QuestionResponse(**response_data)
        print(f"  Created: {response}")
        
        # 测试 QuestionImportRequest
        print("\n3. QuestionImportRequest:")
        import_data = {
            "questions": [create_data]
        }
        import_request = QuestionImportRequest(**import_data)
        print(f"  Created: {import_request}")
        
        return True
    except Exception as e:
        print(f"FAIL: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_practice_schemas():
    """测试练习相关模型。"""
    print("\n=== Testing Practice Schemas ===")
    
    try:
        from app.models.schemas import PracticeEvaluateRequest, PracticeEvaluateResponse, PracticeStatsResponse
        
        # 测试 PracticeEvaluateRequest
        print("\n1. PracticeEvaluateRequest:")
        request_data = {
            "question_id": "q_12345678",
            "user_answer": "Python 是一种编程语言"
        }
        request = PracticeEvaluateRequest(**request_data)
        print(f"  Created: {request}")
        
        # 测试 PracticeEvaluateResponse
        print("\n2. PracticeEvaluateResponse:")
        response_data = {
            "id": "pr_12345678",
            "question_id": "q_12345678",
            "score": 85,
            "feedback": "回答正确",
            "evaluated_at": "2024-01-01T00:00:00"
        }
        response = PracticeEvaluateResponse(**response_data)
        print(f"  Created: {response}")
        
        # 测试 PracticeStatsResponse
        print("\n3. PracticeStatsResponse:")
        stats_data = {
            "total_count": 10,
            "average_score": 85.5,
            "highest_score": 100,
            "lowest_score": 70,
            "recent_records": []
        }
        stats = PracticeStatsResponse(**stats_data)
        print(f"  Created: {stats}")
        
        return True
    except Exception as e:
        print(f"FAIL: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_resume_schemas():
    """测试简历相关模型。"""
    print("\n=== Testing Resume Schemas ===")
    
    try:
        from app.models.schemas import ResumeResponse, ResumeAnalysisResponse
        
        # 测试 ResumeResponse
        print("\n1. ResumeResponse:")
        response_data = {
            "id": "r_12345678",
            "filename": "resume.pdf",
            "file_size": 1024,
            "score": 85,
            "created_at": "2024-01-01T00:00:00"
        }
        response = ResumeResponse(**response_data)
        print(f"  Created: {response}")
        
        # 测试 ResumeAnalysisResponse
        print("\n2. ResumeAnalysisResponse:")
        analysis_data = {
            "id": "r_12345678",
            "filename": "resume.pdf",
            "score": 85,
            "analysis": "简历分析报告",
            "created_at": "2024-01-01T00:00:00"
        }
        analysis = ResumeAnalysisResponse(**analysis_data)
        print(f"  Created: {analysis}")
        
        return True
    except Exception as e:
        print(f"FAIL: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """主测试函数。"""
    print("=" * 60)
    print("Schema Validation Test")
    print("=" * 60)
    
    results = []
    
    results.append(("User Schemas", test_user_schemas()))
    results.append(("Knowledge Schemas", test_knowledge_schemas()))
    results.append(("Document Schemas", test_document_schemas()))
    results.append(("Question Schemas", test_question_schemas()))
    results.append(("Practice Schemas", test_practice_schemas()))
    results.append(("Resume Schemas", test_resume_schemas()))
    
    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    failed = sum(1 for _, result in results if not result)
    
    print(f"\nTotal tests: {len(results)}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Pass rate: {passed/len(results)*100:.1f}%")
    
    if failed > 0:
        print("\nFailed tests:")
        for name, result in results:
            if not result:
                print(f"  - {name}")
    
    return failed == 0


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)