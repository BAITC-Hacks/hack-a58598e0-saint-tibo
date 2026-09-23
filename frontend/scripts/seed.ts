/**
 * Local accounts, including the first administrator.
 *
 * Public sign-up can only ever create a regular user, so the very first `admin` has to be
 * promoted out of band. Better Auth owns the `auth` schema, so this goes through its server
 * API and then sets the role on the row it created.
 *
 *   bun run seed                  create the demo accounts (admin@ and user@saint-tibo.local)
 *   bun run admin:grant <email>   promote an existing account, creating it if needed
 *
 * Passwords come from SEED_PASSWORD (default below). Local development only.
 */
import { eq } from "drizzle-orm";

import { authDb } from "../src/app/server/auth-db.server";
import { user } from "../src/app/server/auth-schema";
import { auth } from "../src/app/server/auth.server";

const password = process.env.SEED_PASSWORD ?? "saint-tibo-dev";

const upsert = async (email: string, name: string, role: "admin" | "user") => {
  const existing = await authDb.query.user.findFirst({
    where: eq(user.email, email),
  });
  if (!existing) {
    await auth.api.signUpEmail({ body: { email, name, password } });
  }
  await authDb.update(user).set({ role }).where(eq(user.email, email));
  process.stdout.write(
    `${existing ? "Updated" : "Created"} ${email} (${role})\n`
  );
};

const [command, email] = process.argv.slice(2);

if (command === "grant") {
  if (!email) {
    throw new Error("Usage: bun run admin:grant <email>");
  }
  await upsert(email, email.split("@")[0] ?? "Admin", "admin");
} else {
  await upsert("admin@saint-tibo.local", "Admin", "admin");
  await upsert("user@saint-tibo.local", "User", "user");
}

process.stdout.write(`Password for accounts created here: ${password}\n`);
process.exit(0);
