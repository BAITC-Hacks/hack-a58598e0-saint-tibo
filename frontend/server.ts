/**
 * Production server: static files from the client build, everything else through the
 * TanStack Start handler. Run it with `bun run start` after `bun run build`.
 */
import start from "./dist/server/server.js";

const clientDir = new URL("./dist/client/", import.meta.url);

const staticFile = async (pathname: string) => {
  if (pathname === "/" || pathname.includes("..")) {
    return null;
  }
  const file = Bun.file(new URL(`.${pathname}`, clientDir));
  return (await file.exists()) ? file : null;
};

Bun.serve({
  port: Number(process.env.FRONTEND_PORT ?? 3000),
  hostname: process.env.HOST ?? "0.0.0.0",
  fetch: async (request) => {
    const file = await staticFile(new URL(request.url).pathname);
    return file ? new Response(file) : start.fetch(request);
  },
});
