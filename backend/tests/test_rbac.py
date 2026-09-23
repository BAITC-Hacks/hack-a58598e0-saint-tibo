import pytest
from fastapi.testclient import TestClient

from saint_tibo.auth.dependencies import get_current_user, require_permissions
from saint_tibo.auth.policy import Permission, Role, permissions_for
from saint_tibo.auth.schemas import CurrentUser
from saint_tibo.main import create_api, create_app


@pytest.mark.parametrize("role,status", [(Role.USER, 403), (Role.ADMIN, 200)])
def test_admin_endpoint_requires_permission(settings, role, status):
    app = create_api(settings)
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id="test-user", role=role, permissions=permissions_for(role)
    )
    with TestClient(app) as client:
        response = client.get("/api/v1/admin/access")
    assert response.status_code == status
    if status == 403:
        assert response.json()["error"]["code"] == "forbidden"
    else:
        assert response.json()["roles"]["user"] == permissions_for(Role.USER)


def test_anonymous_admin_request_is_unauthorized(settings):
    with TestClient(create_app(settings)) as client:
        assert client.get("/api/v1/admin/access").status_code == 401


def test_empty_requirement_is_a_programming_error():
    with pytest.raises(ValueError):
        require_permissions()


async def test_every_permission_is_required():
    dependency = require_permissions(Permission.PROFILE_READ, Permission.USERS_MANAGE)
    user = CurrentUser(id="test-user", role=Role.USER, permissions=permissions_for(Role.USER))
    from saint_tibo.core.errors import APIError

    with pytest.raises(APIError) as error:
        await dependency(user)
    assert error.value.status == 403


async def test_jwt_role_claims_do_not_grant_permissions(settings, jwks, make_token):
    import httpx

    from saint_tibo.auth.jwt import TokenVerifier

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, json=jwks))
    ) as client:
        identity = await TokenVerifier(settings, client).verify(
            make_token({"role": "admin", "permissions": ["users:manage"]})
        )
    assert identity.model_dump() == {"id": "user-123", "session_id": "session-123"}
