// CI harness for the real auth configuration, independent of the UI build.
import { auth } from "../src/app/server/auth.server";

Bun.serve({
  hostname: "127.0.0.1",
  port: Number(
    new URL(process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:3100").port
  ),
  fetch: async (request) => {
    try {
      return await auth.handler(request);
    } catch {
      return new Response("Authentication request failed", { status: 500 });
    }
  },
});
