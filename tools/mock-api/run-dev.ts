import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
if (process.env.NODE_ENV === "production") {
  throw new Error("Synthetic mock mode cannot run with NODE_ENV=production.");
}

const run = async (args: string[], env = process.env) => {
  const child = Bun.spawn(args, {
    cwd: root,
    env,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const status = await child.exited;
  if (status !== 0) {
    throw new Error(`${args.join(" ")} exited with ${status}`);
  }
};

let localEnv: string;
try {
  localEnv = await readFile(`${root}.env`, "utf8");
} catch {
  localEnv = (await readFile(`${root}.env.example`, "utf8"))
    .replace(/^COMPOSE_PROJECT_NAME=.*$/m, "COMPOSE_PROJECT_NAME=saint_tibo_85")
    .replace(/^POSTGRES_PORT=.*$/m, "POSTGRES_PORT=5435")
    .replace(/^FRONTEND_PORT=.*$/m, "FRONTEND_PORT=3005")
    .replace(/^BACKEND_PORT=.*$/m, "BACKEND_PORT=8005");
  await writeFile(`${root}.env`, localEnv, { flag: "wx", mode: 0o600 });
}

const value = (key: string, fallback: string) =>
  localEnv.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1] ?? fallback;
const port = value("MOCK_API_PORT", "8015");
const mockUrl = `http://localhost:${port}`;

if (!(await Bun.file(`${root}frontend/node_modules/vite/package.json`).exists())) {
  await run(["bun", "run", "setup"]);
} else {
  await run(["bun", "run", "infra"]);
  await run(["bun", "run", "migrate"]);
}
await run(["bun", "run", "mock:server"]);

const env = {
  ...process.env,
  VITE_API_MODE: "mock",
  VITE_MOCK_API_URL: mockUrl,
  BACKEND_INTERNAL_URL: mockUrl,
};
const api = Bun.spawn(
  [
    "uv",
    "run",
    "--directory",
    "backend",
    "uvicorn",
    "saint_tibo.main:create_app",
    "--factory",
    "--reload",
    "--port",
    value("BACKEND_PORT", "8000"),
  ],
  { cwd: root, env, stdin: "inherit", stdout: "inherit", stderr: "inherit" }
);
const web = Bun.spawn(
  ["bun", "--env-file=../.env", "run", "--cwd", "frontend", "dev"],
  { cwd: root, env, stdin: "inherit", stdout: "inherit", stderr: "inherit" }
);
const stop = () => {
  api.kill();
  web.kill();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
const [name, status] = await Promise.race([
  api.exited.then((code) => ["backend", code] as const),
  web.exited.then((code) => ["frontend", code] as const),
]);
stop();
if (status !== 0) {
  throw new Error(`${name} exited with ${status}`);
}
