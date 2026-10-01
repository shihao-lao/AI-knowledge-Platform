"""Exercise the real OpenAI client and response validation without external requests."""
import json

import httpx
import pytest
from openai import AsyncOpenAI

from app.infrastructure.llm import evaluation


@pytest.mark.asyncio
@pytest.mark.parametrize('content, valid', [
    (json.dumps({'score': 85, 'feedback': 'Correct', 'key_points': ['types'],
                 'reference_summary': 'A programming language'}), True),
    ('not JSON', False),
    (json.dumps({'score': 101, 'feedback': 'Bad score', 'key_points': [], 'reference_summary': 'Summary'}), False),
    (json.dumps({'score': True, 'feedback': 'Bad type', 'key_points': [], 'reference_summary': 'Summary'}), False),
    (json.dumps({'score': 50, 'feedback': 'Missing fields'}), False),
])
async def test_provider_response_validation(monkeypatch, content, valid):
    monkeypatch.setenv('MIMO_API_KEY', 'test-provider-key')
    monkeypatch.setenv('MIMO_BASE_URL', 'https://test-provider.invalid/v1')
    calls = []

    def handle(request):
        body = json.loads(request.content)
        calls.append(body)
        assert body['response_format'] == {'type': 'json_object'}
        data = json.loads(body['messages'][1]['content'])
        assert data['keywords'] == ['Python', 'language']
        assert data['reference_answer'] == 'A language'
        return httpx.Response(200, json={'id': 'test', 'object': 'chat.completion', 'created': 0,
            'model': 'test-model', 'choices': [{'index': 0, 'finish_reason': 'stop',
                'message': {'role': 'assistant', 'content': content}}]})

    # 配置解析统一走 build_async_client，这里替换它并注入 MockTransport，
    # 仍然使用真实的 AsyncOpenAI 客户端与应答校验逻辑
    def build_client(config, timeout=None):
        return AsyncOpenAI(
            api_key=config.api_key,
            base_url=config.base_url,
            http_client=httpx.AsyncClient(transport=httpx.MockTransport(handle)),
        )

    monkeypatch.setattr(evaluation, 'build_async_client', build_client)
    if valid:
        result = await evaluation.evaluate('What is Python?', 'A language', 'My answer', ['Python', 'language'])
        assert result.score == 85 and result.key_points == ['types']
    else:
        with pytest.raises(RuntimeError, match='无效结果'):
            await evaluation.evaluate('What is Python?', 'A language', 'My answer', ['Python', 'language'])
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_unconfigured_provider_fails_explicitly(monkeypatch):
    monkeypatch.delenv('MIMO_API_KEY', raising=False)
    monkeypatch.delenv('OPENAI_API_KEY', raising=False)
    with pytest.raises(RuntimeError, match='尚未配置大模型'):
        await evaluation.evaluate('Question', 'Reference', 'Answer', [])
