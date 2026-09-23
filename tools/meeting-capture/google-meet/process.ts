import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { CaptureError } from "../lifecycle.ts";

/** Every child is an owned POSIX process group. Never kill by executable name. */
export class OwnedProcess {
  readonly child: ChildProcess;
  readonly done: Promise<{ code: number | null; signal: NodeJS.Signals | null; failed: boolean }>;
  exited = false;
  #killed = false;
  constructor(executable: string, args: string[], env: NodeJS.ProcessEnv, stdin = false) {
    this.child = spawn(executable, args, { env, detached: true, stdio: [stdin ? "pipe" : "ignore", "pipe", "ignore"] });
    this.child.stdin?.on("error", () => {}); // EPIPE while the encoder exits is handled by its result/EOS.
    this.done = new Promise(resolve => {
      this.child.once("error", () => { this.exited = true; resolve({ code: null, signal: null, failed: true }); });
      this.child.once("close", (code, signal) => { this.exited = true; resolve({ code, signal, failed: false }); });
    });
  }
  kill(signal: NodeJS.Signals = "SIGKILL") {
    if (!this.child.pid || this.#killed) return;
    try { process.kill(-this.child.pid, signal); if (signal === "SIGKILL") this.#killed = true; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw new CaptureError("cleanup_failed");
      this.#killed = true;
    }
  }
}

export async function poll(check: () => Promise<boolean>, signal: AbortSignal, interval = 200) {
  for (;;) {
    signal.throwIfAborted();
    if (await check()) { signal.throwIfAborted(); return; }
    await delay(interval, undefined, { signal });
  }
}
