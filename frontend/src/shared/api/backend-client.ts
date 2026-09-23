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
