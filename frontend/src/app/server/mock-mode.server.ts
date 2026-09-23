import { serverEnv } from "#/shared/config/index.server";

import { auth } from "./auth.server";

const cookieName = "saint_tibo_mock_user";
const enabled = () =>
  serverEnv.devLoginEnabled &&
  process.env.MOCK_API_ENABLED === "true" &&
  new Set([
    "localhost",
    "127.0.0.1",
    "dev-danil.saint-tibo.win",
    "dev-ivan.saint-tibo.win",
    "dev-artem.saint-tibo.win",
  ]).has(new URL(serverEnv.betterAuthUrl).hostname);
const check = async (base: string) => {
  try {
    return (
      await fetch(new URL("/health/ready", base), {
        signal: AbortSignal.timeout(3000),
      })
    ).ok;
  } catch {
    return false;
  }
};
const response = (status: number, message: string) =>
  Response.json(
    { error: { code: message, message, details: null } },
    { status }
  );

const sessionFor = async (request: Request) => {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  return auth.api.getSession({
    headers: new Headers({ cookie }),
    query: { disableCookieCache: true },
  });
};

const sameOrigin = (request: Request) => {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  return (
    (!origin || origin === new URL(serverEnv.betterAuthUrl).origin) &&
    (!site || site === "same-origin" || site === "none")
  );
};

const selected = (request: Request, userId: string) =>
  request.headers
    .get("cookie")
    ?.split("; ")
    .some((part) => part === `${cookieName}=${encodeURIComponent(userId)}`) ??
  false;

export async function mockMode(request: Request) {
  if (!sameOrigin(request)) return response(403, "forbidden");
  const session = await sessionFor(request);
  if (!session) return response(401, "unauthorized");
  if (request.method === "GET") {
    const [realConnected, mockConnected] = await Promise.all([
      check(serverEnv.backendInternalUrl),
      enabled()
        ? check(process.env.MOCK_API_INTERNAL_URL ?? "http://mock-api:8015")
        : Promise.resolve(false),
    ]);
    return Response.json(
      {
        mode: enabled() && selected(request, session.user.id) ? "mock" : "real",
        enabled: enabled(),
        realConnected,
        mockConnected,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }
  if (!enabled()) return response(404, "not_found");
  if (request.method !== "POST") return response(405, "method_not_allowed");
  const body = await request.json().catch(() => null);
  if (body?.mode !== "real" && body?.mode !== "mock")
    return response(422, "validation_error");
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  headers.append(
    "Set-Cookie",
    `${cookieName}=${body.mode === "mock" ? encodeURIComponent(session.user.id) : ""}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${body.mode === "mock" ? 2592000 : 0}${new URL(serverEnv.betterAuthUrl).protocol === "https:" ? "; Secure" : ""}`
  );
  return Response.json({ mode: body.mode, enabled: true }, { headers });
}

export async function proxyMock(request: Request) {
  if (!enabled()) return response(404, "not_found");
  if (!sameOrigin(request)) return response(403, "forbidden");
  const session = await sessionFor(request);
  if (!session) return response(401, "unauthorized");
  if (!selected(request, session.user.id))
    return response(403, "mock_not_selected");
  const url = new URL(request.url);
  const path = url.pathname.slice("/api/mock".length);
  if (
    !(path === "/api/v1/meetings" || path.startsWith("/api/v1/meetings/")) &&
    path !== "/api/v1/demo/reset"
  )
    return response(404, "not_found");
  const headers = new Headers({ "X-Mock-User": session.user.id });
  const { token } = await auth.api.getToken({
    headers: new Headers({ cookie: request.headers.get("cookie") ?? "" }),
  });
  headers.set("Authorization", `Bearer ${token}`);
  for (const name of ["content-type", "range", "if-range"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const upstream = await fetch(
      new URL(
        path + url.search,
        process.env.MOCK_API_INTERNAL_URL ?? "http://mock-api:8015"
      ),
      {
        method: request.method,
        headers,
        body: ["GET", "HEAD"].includes(request.method)
          ? undefined
          : await request.arrayBuffer(),
        redirect: "error",
        cache: "no-store",
      }
    );
    const out = new Headers({
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    for (const name of [
      "content-type",
      "content-length",
      "content-range",
      "content-disposition",
      "accept-ranges",
      "x-saint-tibo-mock",
    ]) {
      const value = upstream.headers.get(name);
      if (value) out.set(name, value);
    }
    return new Response(request.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      headers: out,
    });
  } catch {
    return response(503, "mock_unavailable");
  }
}

export const mockSelectedFor = async (request: Request) => {
  if (!enabled()) return false;
  const session = await sessionFor(request);
  return !!session && selected(request, session.user.id);
};
