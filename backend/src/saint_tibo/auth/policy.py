"""Application permissions. New roles receive only explicitly granted permissions."""

from enum import StrEnum
from types import MappingProxyType


class Role(StrEnum):
    USER = "user"
    ADMIN = "admin"


class Permission(StrEnum):
    PROFILE_READ = "profile:read"
    MEETING_READ = "meeting:read"
    MEETING_WRITE = "meeting:write"
    ACCESS_READ = "access:read"
    USERS_READ = "users:read"
    USERS_MANAGE = "users:manage"
    SESSIONS_REVOKE = "sessions:revoke"


ROLE_PERMISSIONS = MappingProxyType(
    {
        Role.USER: frozenset(
            {Permission.PROFILE_READ, Permission.MEETING_READ, Permission.MEETING_WRITE}
        ),
        Role.ADMIN: frozenset(
            {
                Permission.PROFILE_READ,
                Permission.MEETING_READ,
                Permission.MEETING_WRITE,
                Permission.ACCESS_READ,
                Permission.USERS_READ,
                Permission.USERS_MANAGE,
                Permission.SESSIONS_REVOKE,
            }
        ),
    }
)


def permissions_for(role: Role) -> list[Permission]:
    return sorted(ROLE_PERMISSIONS.get(role, frozenset()))
