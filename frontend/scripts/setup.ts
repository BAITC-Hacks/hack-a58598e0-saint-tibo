import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const expectedBun = (await Bun.file(`${root}.bun-version`).text()).trim();
if (Bun.version !== expectedBun) {
  throw new Error(`Use Bun ${expectedBun}; current version is ${Bun.version}.`);
}

const environment = Bun.file(`${root}.env`);
if (!(await environment.exists())) {
  const template = await Bun.file(`${root}.env.example`).text();
  await writeFile(
    `${root}.env`,
    template.replace(
      "BETTER_AUTH_SECRET=",
      `BETTER_AUTH_SECRET=${randomBytes(32).toString("hex")}`
    ),
    { flag: "wx", mode: 0o600 }
  );
  process.stdout.write("Created root .env with a random auth secret.\n");
} else {
  const existing = await environment.text();
  const emptySecret = /^BETTER_AUTH_SECRET=(?:""|'')?[ \t]*(?:#.*)?$/m;
  if (emptySecret.test(existing) || !/^BETTER_AUTH_SECRET=/m.test(existing)) {
    const secret = `BETTER_AUTH_SECRET=${randomBytes(32).toString("hex")}`;
    await writeFile(
      `${root}.env`,
      emptySecret.test(existing)
        ? existing.replace(emptySecret, secret)
        : `${existing.trimEnd()}\n${secret}\n`,
      { mode: 0o600 }
    );
    process.stdout.write("Filled missing auth secret in root .env.\n");
  } else {
    process.stdout.write("Keeping existing root .env.\n");
  }
}

// Bun.file created before the write can keep the old empty snapshot.
let configured = await Bun.file(`${root}.env`).text();
const additions: string[] = [];
if (!/^BACKEND_INTERNAL_URL=/m.test(configured)) {
  additions.push("BACKEND_INTERNAL_URL=http://localhost:${BACKEND_PORT}");
}
if (!/^DEV_LOGIN_ENABLED=/m.test(configured)) {
  additions.push("DEV_LOGIN_ENABLED=false");
}
if (additions.length > 0) {
  configured = `${configured.trimEnd()}\n${additions.join("\n")}\n`;
  await writeFile(`${root}.env`, configured, { mode: 0o600 });
  process.stdout.write(
    "Added missing local server settings with dev login disabled by default.\n"
  );
}

const install = Bun.spawn(["bun", "run", "install:all"], {
  cwd: root,
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});
process.exitCode = await install.exited;
