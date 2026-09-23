import { mkdtempSync, chmodSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import type { Browser, Page, BrowserType } from "playwright-core";
import { CaptureError, type CaptureAdapter } from "../lifecycle.ts";
import { parseMeetingUrl } from "../url.ts";
import { captureProcess, opusOutputArgs } from "./audio.ts";
import { joinGuest, meetState, restrictNetwork } from "./browser.ts";
import { OwnedProcess, poll } from "./process.ts";

export type GoogleMeetOptions = {
  /** Operator-provisioned executables/module. Never accept these from public request bodies. */
  chromium: string; pulseaudio: string; ffmpeg: string; playwright_module: string;
  recording_notice_confirmed: boolean;
  /** Dedicated runner firewall: no private/service IP egress, including WebRTC and DNS rebinding. */
  network_isolation_confirmed: boolean;
};

export class GoogleMeetAdapter implements CaptureAdapter {
  readonly platform = "google_meet" as const;
  readonly capabilities = { joins_as_participant: true, provides_mixed_audio: true, provides_participant_audio: false } as const;
  readonly #options: GoogleMeetOptions;
  readonly #failure = new AbortController();
  readonly #processes: OwnedProcess[] = [];
  #directory?: string;
  #pulse?: OwnedProcess;
  #chrome?: OwnedProcess;
  #browser?: Browser;
  #page?: Page;
  #closed = false;
  #admitted = false;
  #capturing = false;
  constructor(options: GoogleMeetOptions) {
    if (options.recording_notice_confirmed !== true || options.network_isolation_confirmed !== true
        || ![options.chromium, options.pulseaudio, options.ffmpeg, options.playwright_module].every(isAbsolute)) throw new Error("invalid_meet_configuration");
    this.#options = { ...options };
  }
  #spawn(executable: string, args: string[], env: NodeJS.ProcessEnv, stdin = false) {
    if (this.#closed) throw new CaptureError("cancelled");
    const child = new OwnedProcess(executable, args, env, stdin);
    this.#processes.push(child);
    return child;
  }
  #healthy() {
    this.#failure.signal.throwIfAborted();
    if (this.#closed || this.#pulse?.exited || this.#chrome?.exited) throw new CaptureError("media_unavailable");
  }
  async join(context: Parameters<CaptureAdapter["join"]>[0]) {
    context.signal.throwIfAborted();
    if (this.#directory || this.#closed) throw new CaptureError("adapter_failed");
    if (process.platform !== "linux" || !process.env.DISPLAY) throw new CaptureError("media_unavailable");
    const target = parseMeetingUrl(context.target.join_url);
    if (target.platform !== this.platform || !context.display_name.trim() || context.display_name.length > 100
        || /[\x00-\x1f\x7f]/.test(context.display_name)) throw new CaptureError("adapter_failed");
    const signal = AbortSignal.any([context.signal, this.#failure.signal]);
    this.#directory = mkdtempSync(join(tmpdir(), "meet-"));
    chmodSync(this.#directory, 0o700);
    const socket = join(this.#directory, "pulse.sock");
    // No module-udev-detect, physical devices, host default source or host Pulse server.
    this.#pulse = this.#spawn(this.#options.pulseaudio, ["--daemonize=no", "--use-pid-file=no", "--exit-idle-time=-1",
      "--disallow-exit=yes", "-n", "--load", `module-native-protocol-unix socket=${socket} auth-anonymous=1`,
      "--load", "module-null-sink sink_name=meet rate=48000 channels=1", "--log-target=stderr"], this.#env());
    this.#pulse.child.stdout?.resume();
    await poll(async () => { this.#healthy(); return existsSync(socket); }, signal);
    signal.throwIfAborted();
    const profile = join(this.#directory, "chromium");
    this.#chrome = this.#spawn(this.#options.chromium, ["--enable-automation", "--no-first-run", "--no-default-browser-check",
      "--disable-background-networking", "--disable-component-update", "--disable-sync", "--lang=en-US",
      "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], this.#env());
    this.#chrome.child.stdout?.resume();
    const activePort = join(profile, "DevToolsActivePort");
    await poll(async () => { this.#healthy(); return existsSync(activePort); }, signal);
    const [port, endpoint] = readFileSync(activePort, "utf8").trim().split("\n");
    if (!port || !/^\d{1,5}$/.test(port) || Number(port) > 65535 || !endpoint || !/^\/devtools\/browser\/[a-zA-Z0-9-]+$/.test(endpoint)) throw new CaptureError("adapter_failed");
    const { chromium } = await import(pathToFileURL(this.#options.playwright_module).href) as { chromium: BrowserType };
    signal.throwIfAborted();
    this.#browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 10_000 });
    signal.throwIfAborted();
    const browserContext = await this.#browser.newContext({ locale: "en-US", serviceWorkers: "block", acceptDownloads: false });
    signal.throwIfAborted();
    this.#page = await browserContext.newPage();
    signal.throwIfAborted();
    await restrictNetwork(browserContext, this.#page, target.join_url, error => this.#failure.abort(error));
    signal.throwIfAborted();
    try { await this.#page.goto(target.join_url, { waitUntil: "domcontentloaded", timeout: 25_000 }); }
    catch (error) { signal.throwIfAborted(); throw error; }
    await joinGuest(this.#page, `${context.display_name.trim()} (recording)`, signal, context.waitingAdmission);
    this.#healthy();
    this.#admitted = true;
  }
  #env(): NodeJS.ProcessEnv {
    // Keep only runtime necessities; do not pass backend credentials to browser children.
    return { PATH: process.env.PATH, HOME: this.#directory, DISPLAY: process.env.DISPLAY,
      XAUTHORITY: process.env.XAUTHORITY, LANG: "en_US.UTF-8", TMPDIR: this.#directory,
      XDG_RUNTIME_DIR: this.#directory, PULSE_SERVER: `unix:${this.#directory}/pulse.sock`, PULSE_SINK: "meet" };
  }
  async capture(context: Parameters<CaptureAdapter["capture"]>[0]) {
    this.#healthy();
    context.signal.throwIfAborted();
    if (!this.#admitted || !this.#page || this.#capturing) throw new CaptureError("adapter_failed");
    this.#capturing = true;
    const stop = new AbortController(), monitor = new AbortController();
    const signal = AbortSignal.any([context.signal, this.#failure.signal]);
    const encoder = this.#spawn(this.#options.ffmpeg, ["-hide_banner", "-loglevel", "error",
      "-f", "pulse", "-i", "meet.monitor", ...opusOutputArgs], this.#env(), true);
    const watchdog = poll(async () => {
      this.#healthy();
      const state = await meetState(this.#page!);
      if (state === "ended") { stop.abort(); return true; }
      if (state !== "joined") throw new CaptureError("media_unavailable");
      return false;
    }, monitor.signal, 500).catch(error => {
      if (!monitor.signal.aborted) this.#failure.abort(error instanceof CaptureError ? error : new CaptureError("adapter_failed"));
    });
    try {
      await captureProcess(encoder, { ...context, signal, stop: AbortSignal.any([context.stop, stop.signal]) });
      if (!context.stop.aborted && !stop.signal.aborted) throw new CaptureError("media_unavailable");
    } finally { monitor.abort(); await watchdog; }
  }
  async cleanup(signal: AbortSignal) {
    try {
      signal.throwIfAborted();
      if (this.#page && !this.#page.isClosed()) {
        const leave = this.#page.getByRole("button", { name: /^Leave call(?:\s|$)/i }).first();
        if (await leave.isVisible()) {
          await leave.click({ timeout: 2_000 });
          await poll(async () => !await leave.isVisible(), signal);
        }
      }
      signal.throwIfAborted();
      await this.#browser?.close();
    } finally {
      this.forceCleanup();
      await Promise.all(this.#processes.map(child => child.done));
      this.forceCleanup();
    }
  }
  forceCleanup() {
    this.#closed = true;
    let failed = false;
    for (const child of this.#processes.toReversed()) { try { child.kill(); } catch { failed = true; } }
    // Keep a failed deletion retryable; the shared lifecycle always calls this again.
    if (this.#directory) { try { rmSync(this.#directory, { recursive: true, force: true }); } catch { failed = true; } }
    if (failed) throw new CaptureError("cleanup_failed");
  }
}
