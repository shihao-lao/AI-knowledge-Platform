"""通过实际路由与 SQLite 验证上传、保存、重载、导出及资源归属。"""

from contextlib import asynccontextmanager
from io import BytesIO

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.routes.auth import get_current_user_dependency
from app.api.routes.resume import router
from app.infrastructure.database.models import Base, Resume, User
from app.models.schemas import UserResponse
from app.services import resume_service


@pytest.mark.asyncio
async def test_upload_edit_reload_export_and_ownership(monkeypatch, tmp_path):
    engine = create_async_engine('sqlite+aiosqlite:///:memory:')
    sessions = async_sessionmaker(engine, expire_on_commit=False)

    @asynccontextmanager
    async def session_context():
        async with sessions() as session:
            yield session

    async def unavailable_analysis(_content):
        raise RuntimeError('测试使用本地解析，无外部模型调用')

    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv('MIMO_API_KEY', raising=False)
    monkeypatch.delenv('OPENAI_API_KEY', raising=False)
    monkeypatch.setattr(resume_service, 'get_session_context', session_context)
    monkeypatch.setattr(resume_service, 'analyze_resume', unavailable_analysis)
    app = FastAPI()
    app.include_router(router, prefix='/api/v1')
    user = UserResponse(id='resume-test-owner', name='测试用户', email='qa@example.com', created_at='2026-09-27')
    app.dependency_overrides[get_current_user_dependency] = lambda: user
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            session.add(User(id=user.id, name=user.name, email=user.email, password_hash='unused-test-hash'))
            await session.commit()

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
            source = '测试用户\n前端工程师\n专业技能\nReact, TypeScript\n开源贡献\n' + '保持完整原文和换行。\n' * 800
            response = await client.post('/api/v1/resumes/upload', files={'file': ('qa.txt', source.encode(), 'text/plain')})
            assert response.status_code == 201, response.text
            uploaded = response.json()['data']
            assert uploaded['content'] == source.strip()
            assert len(uploaded['content']) > 8000
            resume_id = uploaded['id']
            structure = uploaded['structured']
            # 前端收到 camelCase，提交同样的键名必须保留自定义栏目。
            structure['customSections'] = structure.pop('custom_sections')
            structure['customSections'][0]['content'] = '修改后的贡献\n第二行仍然保留'
            structure['layout']['sections'].reverse()
            response = await client.put(f'/api/v1/resumes/{resume_id}/structure', json={'structured': structure})
            assert response.status_code == 200, response.text
            saved = response.json()['data']['structured']
            assert saved['custom_sections'][0]['content'] == '修改后的贡献\n第二行仍然保留'
            loaded = await client.get(f'/api/v1/resumes/{resume_id}')
            assert loaded.json()['data']['structured'] == saved
            for fmt in ('pdf', 'docx'):
                exported = await client.get(f'/api/v1/resumes/{resume_id}/export', params={'format': fmt})
                assert exported.status_code == 200, exported.text
                assert "filename*=UTF-8''" in exported.headers['content-disposition']
                if fmt == 'pdf':
                    from pypdf import PdfReader
                    text = ''.join(page.extract_text() for page in PdfReader(BytesIO(exported.content)).pages)
                    assert '修改后的贡献' in text
                    assert text.index('开源贡献') < text.index('专业技能')
                else:
                    from app.etl.parser import DocumentParser
                    text = DocumentParser().parse_bytes(exported.content, 'edited.docx', None).text
                    assert '修改后的贡献\n第二行仍然保留' in text
            # 模拟旧记录截断正文；重新解析应从原上传文件恢复完整内容。
            async with sessions() as session:
                record = await session.get(Resume, resume_id)
                record.content = record.content[:8000]
                await session.commit()
            reparsed = await client.post(f'/api/v1/resumes/{resume_id}/structure/parse')
            assert reparsed.status_code == 200
            assert reparsed.json()['data']['content'] == source.strip()
            user = UserResponse(id='other-user', name='其他用户', email='other@example.com', created_at='2026-09-27')
            for path in (f'/api/v1/resumes/{resume_id}', f'/api/v1/resumes/{resume_id}/export'):
                assert (await client.get(path)).status_code == 404
            assert (await client.put(f'/api/v1/resumes/{resume_id}/structure', json={'structured': structure})).status_code == 404
    finally:
        await engine.dispose()
