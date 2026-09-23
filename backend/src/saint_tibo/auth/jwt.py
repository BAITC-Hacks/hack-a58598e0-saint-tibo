import asyncio
import time

import httpx
import jwt
from jwt import InvalidTokenError, PyJWK
from pydantic import ValidationError

from saint_tibo.auth.schemas import TokenIdentity
from saint_tibo.core.config import Settings
from saint_tibo.core.errors import APIError

ALGORITHM = "EdDSA"


class TokenVerifier:
    """Async JWKS cache with bounded refreshes for unknown key IDs."""

    def __init__(self, settings: Settings, client: httpx.AsyncClient) -> None:
        self.settings = settings
        self.client = client
        self._keys: dict[str, PyJWK] = {}
        self._expires_at = 0.0
        self._last_unknown_refresh = float("-inf")
        self._lock = asyncio.Lock()

    async def _refresh(self) -> None:
        try:
            response = await self.client.get(self.settings.auth_jwks_url)
            response.raise_for_status()
            payload = response.json()
            keys = {
                entry["kid"]: PyJWK.from_dict(entry, algorithm=ALGORITHM)
                for entry in payload["keys"]
                if entry.get("kty") == "OKP"
                and entry.get("crv") == "Ed25519"
                and entry.get("alg", ALGORITHM) == ALGORITHM
                and entry.get("use", "sig") == "sig"
                and isinstance(entry.get("kid"), str)
            }
            if not keys:
                raise ValueError("No supported signing keys")
        except (
            httpx.HTTPError,
            ValueError,
            KeyError,
            TypeError,
            AttributeError,
            jwt.PyJWTError,
        ) as exc:
            raise APIError(
                503, "auth_unavailable", "Authentication service is unavailable"
            ) from exc
        self._keys = keys
        self._expires_at = time.monotonic() + self.settings.jwks_cache_seconds

    async def _get_key(self, kid: str) -> PyJWK:
        async with self._lock:
            refreshed = False
            if time.monotonic() >= self._expires_at:
                await self._refresh()
                refreshed = True
            if kid not in self._keys:
                now = time.monotonic()
                if refreshed:
                    self._last_unknown_refresh = now
                elif (
                    now - self._last_unknown_refresh >= self.settings.jwks_refresh_cooldown_seconds
                ):
                    self._last_unknown_refresh = now
                    await self._refresh()
            key = self._keys.get(kid)
            if key is None:
                raise InvalidTokenError("Unknown signing key")
            return key

    async def verify(self, token: str) -> TokenIdentity:
        try:
            header = jwt.get_unverified_header(token)
            kid = header.get("kid")
            if header.get("alg") != ALGORITHM or not isinstance(kid, str) or not kid:
                raise InvalidTokenError("Unsupported token header")
            key = await self._get_key(kid)
            claims = jwt.decode(
                token,
                key.key,
                algorithms=[ALGORITHM],
                issuer=self.settings.auth_issuer,
                audience=self.settings.auth_audience,
                options={"require": ["exp", "iat", "iss", "aud", "sub", "sid"]},
                leeway=5,
            )
            return TokenIdentity(id=claims["sub"], session_id=claims["sid"])
        except (InvalidTokenError, ValidationError) as exc:
            raise APIError(401, "invalid_token", "Invalid or expired access token") from exc
