import asyncio
import time

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from saint_tibo.auth.jwt import TokenVerifier
from saint_tibo.core.errors import APIError


async def test_valid_token_and_cached_keys(settings, jwks, make_token):
    requests = []

    def handler(request):
        requests.append(request)
        return httpx.Response(200, json=jwks)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        verifier = TokenVerifier(settings, client)
        users = await asyncio.gather(*(verifier.verify(make_token()) for _ in range(10)))
    assert all(user.id == "user-123" for user in users)
    assert users[0].session_id == "session-123"
    assert len(requests) == 1


@pytest.mark.parametrize(
    "claims",
    [
        {"exp": int(time.time()) - 60},
        {"iss": "https://attacker.example"},
        {"aud": "another-service"},
        {"iat": int(time.time()) + 600},
        {"nbf": int(time.time()) + 600},
        {"sub": ""},
        {"sub": 123},
        {"sid": {"unexpected": "object"}},
        {"sid": ""},
    ],
)
async def test_invalid_claims_are_rejected(settings, jwks, make_token, claims):
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, json=jwks))
    ) as client:
        with pytest.raises(APIError) as error:
            await TokenVerifier(settings, client).verify(make_token(claims))
    assert error.value.status == 401


@pytest.mark.parametrize("field", ["exp", "iat", "iss", "aud", "sub", "sid"])
async def test_required_claims(settings, jwks, make_token, field):
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, json=jwks))
    ) as client:
        with pytest.raises(APIError) as error:
            await TokenVerifier(settings, client).verify(make_token(omit=[field]))
    assert error.value.status == 401


async def test_invalid_signature(settings, jwks, make_token):
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, json=jwks))
    ) as client:
        with pytest.raises(APIError) as error:
            await TokenVerifier(settings, client).verify(
                make_token(key=Ed25519PrivateKey.generate())
            )
    assert error.value.status == 401


@pytest.mark.parametrize(
    "token", ["garbage", jwt.encode({"sub": "user-123"}, "x" * 32, algorithm="HS256")]
)
async def test_bad_header_does_not_fetch_keys(settings, token):
    def unexpected_request(request):
        pytest.fail("Malformed tokens should not trigger a JWKS request")

    async with httpx.AsyncClient(transport=httpx.MockTransport(unexpected_request)) as client:
        with pytest.raises(APIError) as error:
            await TokenVerifier(settings, client).verify(token)
    assert error.value.status == 401


async def test_unknown_key_refresh_is_bounded(settings, jwks, make_token):
    calls = 0

    def handler(request):
        nonlocal calls
        calls += 1
        return httpx.Response(200, json=jwks)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        verifier = TokenVerifier(settings, client)
        await verifier.verify(make_token())
        for index in range(10):
            with pytest.raises(APIError) as error:
                await verifier.verify(make_token(kid=f"unknown-{index}"))
            assert error.value.status == 401
    assert calls == 2


async def test_key_rotation(settings, jwks, make_token):
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, json=jwks))
    ) as client:
        verifier = TokenVerifier(settings, client)
        await verifier.verify(make_token())
        jwks["keys"][0]["kid"] = "rotated-key"
        assert (await verifier.verify(make_token(kid="rotated-key"))).id == "user-123"


@pytest.mark.parametrize("response", [httpx.Response(500), httpx.Response(200, json={"keys": []})])
async def test_auth_service_failure(settings, make_token, response):
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: response)) as client:
        with pytest.raises(APIError) as error:
            await TokenVerifier(settings, client).verify(make_token())
    assert error.value.status == 503
    assert error.value.code == "auth_unavailable"
