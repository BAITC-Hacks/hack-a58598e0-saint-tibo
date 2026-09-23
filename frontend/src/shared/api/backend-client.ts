import { z } from "zod";

import { authClient } from "../auth/auth-client";
import { env } from "../config/env";
import { client } from "./generated/client.gen";

const claimsSchema = z.object({ exp: z.number() });
/** Refresh this long before expiry, so an in-flight request never carries a dead token. */
const REFRESH_MARGIN_MS = 15_000;

let cached: { token: string; expiresAt: number } | null = null;

const expiresAt = (token: string): number => {
  const payload = token.split(".")[1];
  if (!payload) {
    return 0;
  }
  const decoded = claimsSchema.safeParse(
    JSON.parse(atob(payload.replaceAll("-", "+").replaceAll("_", "/")))
  );
  return decoded.success ? decoded.data.exp * 1000 : 0;
};

/**
 * Browser client: resolves a JWT from the cookie session for protected requests.
 *
 * `authClient.token()` mints a new token on every call, so the token is reused until it is
 * about to expire. `AuthCacheBoundary` clears it on logout and on a session switch.
 */
export const backendClient = client;

export const mockModeKey = (userId: string) => `saint-tibo-mock:${userId}`;

export const isMockApi = () =>
  typeof window !== "undefined" &&
  window.sessionStorage.getItem("saint-tibo-active-user") !== null &&
  window.localStorage.getItem(
    mockModeKey(window.sessionStorage.getItem("saint-tibo-active-user") ?? "")
  ) === "mock";

function routeMockRequest(request: Request) {
  if (!isMockApi()) return request;
  const url = new URL(request.url);
  if (
    url.pathname === "/api/v1/meetings" ||
    url.pathname.startsWith("/api/v1/meetings/")
  ) {
    if (request.method === "GET" && url.pathname === "/api/v1/meetings") {
      const scenario = new URLSearchParams(window.location.search).get("mock");
      if (scenario && ["empty", "loading", "error"].includes(scenario))
        url.searchParams.set("scenario", scenario);
    }
    const makeRequest = (body?: ArrayBuffer) =>
      new Request(
        new URL(
          `/api/mock${url.pathname}${url.search}`,
          window.location.origin
        ),
        {
          method: request.method,
          headers: request.headers,
          body,
          credentials: "same-origin",
          signal: request.signal,
        }
      );
    return ["GET", "HEAD"].includes(request.method)
      ? makeRequest()
      : request.arrayBuffer().then(makeRequest);
  }
  return request;
}

backendClient.interceptors.request.use(routeMockRequest);

export const forgetAccessToken = () => {
  cached = null;
};

backendClient.setConfig({
  baseUrl: env.VITE_API_URL,
  auth: async () => {
    if (cached && cached.expiresAt - REFRESH_MARGIN_MS > Date.now()) {
      return cached.token;
    }
    const { data, error } = await authClient.token();
    if (error) {
      throw new Error(error.message ?? "Could not obtain an API access token.");
    }
    const token = data?.token;
    if (token) {
      cached = { token, expiresAt: expiresAt(token) };
    }
    return token;
  },
});
