import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { serverEnv } from "#/shared/config/index.server";

import { account, jwks, session, user, verification } from "./auth-schema";

export const authPool = new Pool({
  connectionString: serverEnv.authDatabaseUrl,
  max: 5,
});

export const authDb = drizzle(authPool, {
  schema: { account, jwks, session, user, verification },
});
