import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
if (!(await Bun.file(`${root}.env`).exists())) {
  const setup = Bun.spawn(["bun", "run", "setup"], { cwd: root, stdin: "inherit", stdout: "inherit", stderr: "inherit" });
  if (await setup.exited) throw new Error("Local setup failed");
}
let config = await readFile(`${root}.env`, "utf8");
if (!/^BETTER_AUTH_URL=http:\/\/(localhost|127\.0\.0\.1)[:$]/m.test(config))
  throw new Error("mock:dev changes only a localhost checkout.");
for (const key of ["DEV_LOGIN_ENABLED", "MOCK_API_ENABLED"]) {
  const line = `${key}=true`;
  config = new RegExp(`^${key}=.*$`, "m").test(config)
    ? config.replace(new RegExp(`^${key}=.*$`, "m"), line)
    : `${config.trimEnd()}\n${line}\n`;
}
await writeFile(`${root}.env`, config);
const up = Bun.spawn(["docker", "compose", "--profile", "app", "--profile", "mock", "up", "-d", "--build", "--wait", "frontend", "mock-api"], { cwd: root, stdin: "inherit", stdout: "inherit", stderr: "inherit" });
if (await up.exited) throw new Error("Local demo stack failed");
const port = config.match(/^FRONTEND_PORT=(\d+)$/m)?.[1] ?? "3000";
console.log(`Open http://localhost:${port}/settings and choose demo data.`);
