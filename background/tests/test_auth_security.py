import pytest
from app.services.auth_service import get_secret_key, create_access_token, verify_token


@pytest.mark.parametrize('value', ['', 'short', 'your-secret-key-change-in-production'])
def test_rejects_unsafe_signing_keys(monkeypatch, value):
    monkeypatch.setenv('SECRET_KEY', value)
    with pytest.raises(RuntimeError, match='SECRET_KEY'):
        get_secret_key()


def test_token_verification_uses_configured_secret(monkeypatch):
    monkeypatch.setenv('SECRET_KEY', 'test-only-unique-signing-key-' + 'a' * 32)
    token = create_access_token({'sub': 'owner'})
    assert verify_token(token)['sub'] == 'owner'
    monkeypatch.setenv('SECRET_KEY', 'test-only-unique-signing-key-' + 'b' * 32)
    assert verify_token(token) is None


@pytest.mark.asyncio
async def test_startup_rejects_missing_key_before_opening_database(monkeypatch):
    from app import main
    from unittest.mock import Mock
    monkeypatch.delenv('SECRET_KEY', raising=False)
    engine = Mock()
    monkeypatch.setattr(main, 'init_engine', engine)
    with pytest.raises(RuntimeError, match='SECRET_KEY'):
        async with main.lifespan(main.app):
            pass
    engine.assert_not_called()
