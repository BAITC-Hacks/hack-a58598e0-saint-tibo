import type { CurrentUser, Permission } from "../api/generated/types.gen";

type Access = Pick<CurrentUser, "permissions"> | null | undefined;

export const hasPermission = (
  access: Access,
  permission: Permission
): boolean => access?.permissions.includes(permission) ?? false;

export const hasEveryPermission = (
  access: Access,
  permissions: readonly Permission[]
): boolean =>
  permissions.length > 0 &&
  permissions.every((permission) => hasPermission(access, permission));

export const hasAnyPermission = (
  access: Access,
  permissions: readonly Permission[]
): boolean =>
  permissions.some((permission) => hasPermission(access, permission));
