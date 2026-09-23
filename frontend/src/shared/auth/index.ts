export { authClient } from "./auth-client";
export { AuthCacheBoundary } from "./auth-cache-boundary";
export { Can } from "./can";
export {
  hasPermission,
  hasEveryPermission,
  hasAnyPermission,
} from "./permissions";
export { AccessDeniedError, requireAccess } from "./route-access";
export { accessQueryKey, invalidateAccess, useAccess } from "./use-access";
export type { CurrentUser, Permission, Role } from "../api/generated/types.gen";
