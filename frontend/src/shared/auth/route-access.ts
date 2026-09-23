import { redirect } from "@tanstack/react-router";

import { backendClient } from "../api/backend-client";
import { getCurrentUser } from "../api/generated/sdk.gen";
import type { Permission } from "../api/generated/types.gen";
import { authClient } from "./auth-client";
import { hasEveryPermission } from "./permissions";

export class AccessDeniedError extends Error {
  readonly status = 403;

  constructor() {
    super("You do not have permission to open this page.");
    this.name = "AccessDeniedError";
  }
}

/** TanStack Router beforeLoad guard for this SPA; requests fresh server permissions. */
export const requireAccess = async ({
  permissions,
  returnTo,
}: {
  permissions: Permission[];
  returnTo: string;
}) => {
  if (permissions.length === 0) {
    throw new TypeError("Specify at least one permission.");
  }
  const session = await authClient.getSession();
  if (session.error) {
    throw new Error("Could not verify the current session.");
  }
  if (!session.data) {
    redirect({
      to: "/login",
      search: { redirect: returnTo },
      throw: true,
    });
  }
  const result = await getCurrentUser({ client: backendClient });
  if (result.response?.status === 401) {
    redirect({
      to: "/login",
      search: { redirect: returnTo },
      throw: true,
    });
  }
  if (result.response?.status === 403) {
    throw new AccessDeniedError();
  }
  if (!result.data) {
    throw new Error("Could not verify access permissions.");
  }
  if (!hasEveryPermission(result.data, permissions)) {
    throw new AccessDeniedError();
  }
  return result.data;
};
