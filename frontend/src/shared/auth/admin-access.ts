import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";

import type { Role } from "../api/generated/types.gen";

/** Better Auth account operations. Application permissions come from FastAPI /me. */
export const adminAccessControl = createAccessControl(defaultStatements);

const adminRole = adminAccessControl.newRole({
  user: ["create", "list", "get", "set-role", "ban"],
  session: ["list", "revoke"],
});
const userRole = adminAccessControl.newRole({ user: [], session: [] });

export const adminRoles = {
  admin: adminRole,
  user: userRole,
} satisfies Record<Role, typeof adminRole | typeof userRole>;
