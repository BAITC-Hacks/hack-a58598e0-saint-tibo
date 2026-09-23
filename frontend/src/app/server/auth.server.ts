import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, jwt } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import { adminAccessControl, adminRoles } from "#/shared/auth/index.server";
import { serverEnv } from "#/shared/config/index.server";

import { authDb } from "./auth-db.server";
import { guardAdminChanges } from "./auth-guards.server";

const authBaseURL = serverEnv.betterAuthUrl;
// Browser cookies are not port-scoped, so two local stacks would overwrite each other's
// session cookie. Namespacing by port keeps parallel worktrees independent.
const authPort = new URL(authBaseURL).port;
const cookiePrefix = authPort ? `saint_tibo-${authPort}` : "saint_tibo";

export const auth = betterAuth({
  baseURL: authBaseURL,
  secret: serverEnv.betterAuthSecret,
  // `schemaName` is only read by the Better Auth CLI when regenerating the schema;
  // runtime queries are already qualified by `pgSchema("auth")`.
  database: drizzleAdapter(authDb, { provider: "pg", schemaName: "auth" }),
  advanced: { cookiePrefix },
  hooks: { before: guardAdminChanges },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  plugins: [
    admin({
      defaultRole: "user",
      adminRoles: ["admin"],
      ac: adminAccessControl,
      roles: adminRoles,
    }),
    jwt({
      // The client fetches /api/auth/token explicitly; signing a JWT into a response
      // header on every session read would be wasted work.
      disableSettingJwtHeader: true,
      jwks: {
        keyPairConfig: { alg: "EdDSA", crv: "Ed25519" },
      },
      jwt: {
        issuer: authBaseURL,
        audience: serverEnv.jwtAudience,
        expirationTime: "5m",
        definePayload: ({ session }) => ({ sid: session.id }),
      },
    }),
    tanstackStartCookies(),
  ],
});
