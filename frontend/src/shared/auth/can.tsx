import type { ReactNode } from "react";

import type { Permission } from "../api/generated/types.gen";
import { useAccess } from "./use-access";

/** Presentation only. Protected API operations must also enforce permissions on the server. */
export const Can = ({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}): ReactNode => {
  const access = useAccess();
  return access.can(permission) ? children : fallback;
};
