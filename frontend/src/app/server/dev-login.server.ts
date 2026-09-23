import { eq } from "drizzle-orm";
import { z } from "zod";

import type { ErrorResponse } from "#/shared/api";
import { serverEnv } from "#/shared/config/index.server";

import { authDb } from "./auth-db.server";
import { user } from "./auth-schema";
import { auth } from "./auth.server";

const devOrigins = new Set([
  "https://dev-danil.saint-tibo.win",
  "https://dev-ivan.saint-tibo.win",
  "https://dev-artem.saint-tibo.win",
]);

// Dedicated, disposable development identities; never imported by browser code.
export const devPassword = "saint-tibo-dev";
export const devAccounts = {
  user: {
    id: "saint-tibo-dev-user-v1",
    email: "dev-user@saint-tibo.local",
    name: "Dev User",
  },
  admin: {
    id: "saint-tibo-dev-admin-v1",
    email: "dev-admin@saint-tibo.local",
    name: "Dev Admin",
  },
} as const;

/** Server configuration is authoritative; spoofed Host/Origin cannot enable prod. */
export const devLoginOrigin = (): string | null => {
  if (!serverEnv.devLoginEnabled) return null;
  const configured = serverEnv.betterAuthUrl;
  return devOrigins.has(configured) ? configured : null;
};

const loginBody = z.object({ role: z.enum(["user", "admin"]) }).strict();
const privateHeaders = () =>
  new Headers({
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "same-origin",
  });

const loginError = (status: number, code: string, message: string) => {
  const body: ErrorResponse = { error: { code, message, details: null } };
  return Response.json(body, { status, headers: privateHeaders() });
};

export const devLogin = async (request: Request): Promise<Response> => {
  const origin = devLoginOrigin();
  if (!origin) return loginError(404, "not_found", "Resource was not found.");
  if (request.method !== "POST") {
    const response = loginError(405, "method_not_allowed", "Use POST.");
    response.headers.set("Allow", "POST");
    return response;
  }
  const site = request.headers.get("sec-fetch-site");
  if (
    request.headers.get("origin") !== origin ||
    new URL(request.url).hostname !== new URL(origin).hostname ||
    (site !== null && site !== "same-origin")
  ) {
    return loginError(403, "forbidden", "Same-origin access required.");
  }
  if (
    request.headers.get("content-type")?.split(";", 1)[0]?.trim() !==
    "application/json"
  ) {
    return loginError(
      415,
      "unsupported_media",
      "Send an application/json body."
    );
  }
  const parsed = loginBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return loginError(
      422,
      "validation_error",
      "Choose the user or admin role."
    );
  }

  try {
    const sessionHeaders = new Headers();
    const cookie = request.headers.get("cookie");
    if (cookie) sessionHeaders.set("cookie", cookie);
    const session = await auth.api.getSession({
      headers: sessionHeaders,
      query: { disableCookieCache: true },
    });
    if (session) {
      return Response.json(
        { status: "preserved" },
        { headers: privateHeaders() }
      );
    }

    const { role } = parsed.data;
    const dedicated = devAccounts[role];
    const account = await authDb.query.user.findFirst({
      where: eq(user.email, dedicated.email),
    });
    if (
      !account ||
      account.id !== dedicated.id ||
      account.role !== role ||
      account.banned
    ) {
      return loginError(
        503,
        "dev_account_unavailable",
        "The dedicated development account is not ready."
      );
    }

    // Use the normal Better Auth endpoint. The response token is deliberately discarded.
    const signedIn = await auth.handler(
      new Request(new URL("/api/auth/sign-in/email", origin), {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: origin },
        body: JSON.stringify({ email: dedicated.email, password: devPassword }),
      })
    );
    if (!signedIn.ok) {
      await signedIn.body?.cancel();
      return loginError(
        503,
        "dev_account_unavailable",
        "Development login failed."
      );
    }
    const headers = privateHeaders();
    for (const cookieHeader of signedIn.headers.getSetCookie()) {
      headers.append("Set-Cookie", cookieHeader);
    }
    await signedIn.body?.cancel();
    return Response.json({ status: "signed_in", role }, { headers });
  } catch {
    return loginError(
      503,
      "auth_unavailable",
      "Authentication is temporarily unavailable."
    );
  }
};
