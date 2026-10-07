"""Byte boundaries, HTTP errors and legacy bcrypt compatibility."""

import bcrypt
import httpx
import pytest
from fastapi import FastAPI
from pydantic import ValidationError

from app.api.routes.auth import router
from app.models.schemas import UserCreate
from app.services.auth_service import get_password_hash, verify_password


@pytest.mark.parametrize('password', ['Ab1' + 'a' * 69, 'Ab1' + '中' * 23])
def test_exact_72_bytes_are_valid_and_use_existing_hash_format(password):
    assert len(password.encode()) == 72
    UserCreate(name='Owner', email='owner@test.com', password=password)
    hashed = get_password_hash(password)
    assert hashed.startswith('$2b$')
    assert verify_password(password, hashed)
    assert not verify_password(password + 'a', hashed)


@pytest.mark.parametrize('password', ['Ab1' + 'a' * 70, 'Ab1' + '中' * 24])
def test_overlong_password_is_rejected_before_hashing(password):
    with pytest.raises(ValidationError, match='72'):
        UserCreate(name='Owner', email='owner@test.com', password=password)
    with pytest.raises(ValueError, match='72'):
        get_password_hash(password)


def test_legacy_bcrypt_hash_still_authenticates():
    old_hash = bcrypt.hashpw(b'ExistingPass1', bcrypt.gensalt(rounds=4)).decode()
    assert verify_password('ExistingPass1', old_hash)
    assert not verify_password('WrongPass1', old_hash)


@pytest.mark.asyncio
async def test_registration_rejects_bytes_with_422_then_valid_user_can_login(backend_database):
    app = FastAPI()
    app.include_router(router)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url='http://test') as client:
        data = {'name': 'New', 'email': 'new@test.com', 'password': 'Ab1' + '中' * 24}
        invalid = await client.post('/auth/register', json=data)
        assert invalid.status_code == 422
        assert '72' in invalid.text
        data['password'] = 'Ab1' + '中' * 23
        registered = await client.post('/auth/register', json=data)
        assert registered.status_code == 201
        login = await client.post('/auth/login', json={'email': data['email'], 'password': data['password']})
        assert login.status_code == 200
        assert login.json()['access_token']
