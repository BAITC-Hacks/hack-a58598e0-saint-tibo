import { verifyPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";

import { authDb, authPool } from "../src/app/server/auth-db.server";
import { account, user } from "../src/app/server/auth-schema";
import { auth } from "../src/app/server/auth.server";
import {
  devAccounts,
  devLoginOrigin,
  devPassword,
} from "../src/app/server/dev-login.server";

try {
  if (!devLoginOrigin()) {
    throw new Error(
      "Development seed requires DEV_LOGIN_ENABLED=true and an approved HTTPS dev origin."
    );
  }
  for (const role of ["user", "admin"] as const) {
    const dedicated = devAccounts[role];
    const existing = await authDb.query.user.findFirst({
      where: eq(user.email, dedicated.email),
    });
    if (existing) {
      if (
        existing.id !== dedicated.id ||
        existing.role !== role ||
        existing.banned
      ) {
        throw new Error(
          `Refusing to modify conflicting development account ${dedicated.email}.`
        );
      }
      const credential = await authDb.query.account.findFirst({
        where: and(
          eq(account.userId, existing.id),
          eq(account.providerId, "credential")
        ),
      });
      if (
        !credential?.password ||
        !(await verifyPassword({
          hash: credential.password,
          password: devPassword,
        }))
      ) {
        throw new Error(
          `Refusing to reset the existing password for ${dedicated.email}.`
        );
      }
      process.stdout.write(
        `Verified ${dedicated.email} (${role}); no changes.\n`
      );
      continue;
    }
    const created = await auth.api.createUser({
      body: {
        email: dedicated.email,
        name: dedicated.name,
        password: devPassword,
        role,
        data: { id: dedicated.id },
      },
    });
    if (created.user.id !== dedicated.id) {
      throw new Error(
        "Better Auth did not preserve the dedicated development identity."
      );
    }
    process.stdout.write(`Created ${dedicated.email} (${role}).\n`);
  }
} finally {
  await authPool.end();
}
