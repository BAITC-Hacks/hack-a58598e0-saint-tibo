import { adminClient, jwtClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { adminAccessControl, adminRoles } from "./admin-access";

export const authClient = createAuthClient({
  plugins: [
    jwtClient(),
    adminClient({ ac: adminAccessControl, roles: adminRoles }),
  ],
});
