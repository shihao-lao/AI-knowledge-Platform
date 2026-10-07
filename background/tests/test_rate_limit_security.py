"""Exercise rate limits through ASGI, including Uvicorn's proxy trust boundary."""

import httpx
import pytest
from fastapi import FastAPI
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from app.middleware.rate_limit import RateLimitMiddleware


def make_app():
    app = FastAPI()
    app.add_middleware(RateLimitMiddleware, requests_per_minute=1)

    @app.get('/limited')
    async def limited():
        return {'ok': True}

    return ProxyHeadersMiddleware(app, trusted_hosts=['10.0.0.10'])


@pytest.mark.asyncio
async def test_untrusted_client_cannot_reset_quota_with_forwarded_header():
    transport = httpx.ASGITransport(app=make_app(), client=('203.0.113.1', 1234))
    async with httpx.AsyncClient(transport=transport, base_url='http://test') as client:
        first = await client.get('/limited', headers={'X-Forwarded-For': '198.51.100.1'})
        second = await client.get('/limited', headers={'X-Forwarded-For': '198.51.100.2'})
    assert first.status_code == 200
    assert second.status_code == 429


@pytest.mark.asyncio
async def test_trusted_proxy_preserves_distinct_client_quotas():
    transport = httpx.ASGITransport(app=make_app(), client=('10.0.0.10', 1234))
    async with httpx.AsyncClient(transport=transport, base_url='http://test') as client:
        first = await client.get('/limited', headers={'X-Forwarded-For': '198.51.100.1'})
        repeat = await client.get('/limited', headers={'X-Forwarded-For': '198.51.100.1'})
        other = await client.get('/limited', headers={'X-Forwarded-For': '198.51.100.2'})
    assert [first.status_code, repeat.status_code, other.status_code] == [200, 429, 200]


@pytest.mark.asyncio
async def test_trusted_proxy_ignores_spoofed_leftmost_address():
    transport = httpx.ASGITransport(app=make_app(), client=('10.0.0.10', 1234))
    async with httpx.AsyncClient(transport=transport, base_url='http://test') as client:
        first = await client.get('/limited', headers={'X-Forwarded-For': 'fake-a, 198.51.100.1'})
        second = await client.get('/limited', headers={'X-Forwarded-For': 'fake-b, 198.51.100.1'})
    assert [first.status_code, second.status_code] == [200, 429]
