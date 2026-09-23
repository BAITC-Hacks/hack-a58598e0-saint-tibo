import { defineConfig } from "drizzle-kit";

import { serverEnv } from "./src/shared/config/index.server";

export default defineConfig({
  out: "./drizzle/auth",
  schema: "./src/app/server/auth-schema.ts",
  dialect: "postgresql",
  schemaFilter: ["auth"],
  migrations: { schema: "auth", table: "__drizzle_migrations" },
  dbCredentials: { url: serverEnv.authDatabaseUrl },
});
