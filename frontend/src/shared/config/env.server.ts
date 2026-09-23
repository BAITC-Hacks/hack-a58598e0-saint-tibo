/**
 * Server-side environment. Never import this from browser code.
 *
 * These values have no defaults on purpose: a missing variable must stop the process instead
 * of silently connecting to some other database.
 */
import { config } from "dotenv";

config({ path: [".env.local", ".env", "../.env"], quiet: true });

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Run \`bun run setup\` once, then run commands from the repository root.`
    );
  }
  return value;
};

export const serverEnv = {
  get authDatabaseUrl() {
    return required("AUTH_DATABASE_URL");
  },
  get betterAuthUrl() {
    return required("BETTER_AUTH_URL");
  },
  get betterAuthSecret() {
    return required("BETTER_AUTH_SECRET");
  },
  get jwtAudience() {
    return required("BETTER_AUTH_JWT_AUDIENCE");
  },
  get backendInternalUrl() {
    const url = new URL(required("BACKEND_INTERNAL_URL"));
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      throw new Error("BACKEND_INTERNAL_URL must be an HTTP(S) origin.");
    }
    return url.origin;
  },
};
