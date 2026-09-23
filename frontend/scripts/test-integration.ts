import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const database = `saint_tibo_test_${randomBytes(6).toString("hex")}`;
const user = process.env.POSTGRES_USER ?? "saint_tibo";
const connection = new URL(
  process.env.AUTH_DATABASE_URL ??
    "postgresql://saint_tibo:saint_tibo@localhost:5432/saint_tibo"
);
connection.pathname = `/${database}`;

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to allocate test port");
  }
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return address.port;
}

const authPort = await freePort();
const apiPort = await freePort();
const authUrl = `http://localhost:${authPort}`;
const apiUrl = `http://localhost:${apiPort}`;
const environment = {
  ...process.env,
  NODE_ENV: "test",
  AUTH_DATABASE_URL: connection.toString(),
  BACKEND_DATABASE_URL: connection
    .toString()
    .replace("postgresql:", "postgresql+asyncpg:"),
  TEST_DATABASE_URL: connection
    .toString()
    .replace("postgresql:", "postgresql+asyncpg:"),
  BETTER_AUTH_URL: authUrl,
  BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
  BACKEND_AUTH_ISSUER: authUrl,
  BACKEND_AUTH_JWKS_URL: `${authUrl}/api/auth/jwks`,
  BACKEND_CORS_ORIGINS: JSON.stringify([authUrl]),
};

async function run(command: string[]): Promise<void> {
  const child = Bun.spawn(command, {
    cwd: root,
    env: environment,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  if ((await child.exited) !== 0) {
    throw new Error(`Failed: ${command.join(" ")}`);
  }
}

await run(["docker", "compose", "up", "-d", "--wait", "postgres"]);
await run([
  "docker",
  "compose",
  "exec",
  "-T",
  "postgres",
  "createdb",
  "-U",
  user,
  database,
]);
const services: ReturnType<typeof Bun.spawn>[] = [];
try {
  await run(["bun", "run", "--cwd", "frontend", "auth:db:migrate"]);
  await run([
    "uv",
    "run",
    "--directory",
    "backend",
    "alembic",
    "upgrade",
    "head",
  ]);
  await run(["uv", "run", "--directory", "backend", "pytest"]);
  for (const command of [
    ["bun", "run", "--cwd", "frontend", "scripts/auth-smoke-server.ts"],
    [
      "uv",
      "run",
      "--directory",
      "backend",
      "uvicorn",
      "saint_tibo.main:create_app",
      "--factory",
      "--port",
      String(apiPort),
    ],
  ]) {
    services.push(
      Bun.spawn(command, {
        cwd: root,
        env: environment,
        stdout: "inherit",
        stderr: "inherit",
      })
    );
  }
  for (const script of ["smoke_auth.py", "smoke_rbac.py"]) {
    await run([
      "uv",
      "run",
      "--directory",
      "backend",
      "python",
      `scripts/${script}`,
      "--auth-url",
      authUrl,
      "--api-url",
      apiUrl,
    ]);
  }
} finally {
  for (const service of services) {
    service.kill();
  }
  await Promise.all(services.map((service) => service.exited));
  await run([
    "docker",
    "compose",
    "exec",
    "-T",
    "postgres",
    "dropdb",
    "-U",
    user,
    "--force",
    database,
  ]);
}
