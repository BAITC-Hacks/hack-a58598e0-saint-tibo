import { CaptureError, type AudioChunk, type CaptureAdapter } from "../lifecycle.ts";
import { parseMeetingUrl } from "../url.ts";
import { audioHook } from "./audio-hook.ts";

type Browser = { newContext(options: object): Promise<any>; close(): Promise<void> };
type Launcher = () => Promise<Browser>;
const pollMs = 200;
const zoomHost = (url: string) => { try { const host = new URL(url).hostname; return host === "zoom.us" || /^[a-z0-9-]+\.zoom\.us$/.test(host); } catch { return false; } };
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const quiet = async (operation: () => Promise<unknown>) => { try { await operation(); } catch { /* teardown is best effort */ } };

/** Only numeric Meeting IDs accepted by the shared URL policy. Passcodes stay inside the private target. */
export function meetingUrl(id: string): string {
  if (!/^[0-9]{9,11}$/.test(id)) throw new Error("invalid_meeting_url");
  return `https://zoom.us/j/${id}`;
}

async function launchBrowser(): Promise<Browser> {
  // Optional runtime dependency. No lockfile or shared package manifest change in this isolated adapter.
  const packageName: string = "playwright";
  const { chromium } = await import(packageName);
  return chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
}

/** Experimental browser participant; Zoom UI selectors and media availability require a controlled live gate. */
export class ZoomAdapter implements CaptureAdapter {
  readonly platform = "zoom";
  readonly capabilities = { joins_as_participant: true, provides_mixed_audio: true, provides_participant_audio: false } as const;
  #browser?: Browser;
  #context?: any;
  #page?: any;
  #closed = false;
  #emitter?: (chunk: AudioChunk) => Promise<void>;
  #sequence = 0;
  #end = 0;
  #audioError?: unknown;
  constructor(private readonly launcher: Launcher = launchBrowser, private readonly passcode?: string) {
    if (passcode !== undefined && (!passcode || passcode.length > 128 || /[\x00-\x1f\x7f]/.test(passcode))) throw new Error("invalid_zoom_passcode");
  }

  async join({ target, display_name, signal, waitingAdmission }: Parameters<CaptureAdapter["join"]>[0]): Promise<void> {
    if (target.platform !== "zoom" || parseMeetingUrl(target.join_url).platform !== "zoom") throw new CaptureError("adapter_failed");
    signal.throwIfAborted();
    const browser = await this.launcher();
    if (signal.aborted || this.#closed) { await quiet(() => browser.close()); signal.throwIfAborted(); throw new CaptureError("cancelled"); }
    this.#browser = browser;
    const context = await browser.newContext({ permissions: [], acceptDownloads: false, serviceWorkers: "block" });
    if (signal.aborted || this.#closed) { await quiet(() => context.close()); signal.throwIfAborted(); throw new CaptureError("cancelled"); }
    this.#context = context;
    const page = await context.newPage();
    if (signal.aborted || this.#closed) { await quiet(() => page.close()); signal.throwIfAborted(); throw new CaptureError("cancelled"); }
    this.#page = page;
    page.on("dialog", (dialog: any) => void dialog.dismiss());
    await page.route("**/*", async (route: any) => {
      const request = route.request();
      if (request.isNavigationRequest() && !zoomHost(request.url())) return route.abort();
      return route.fallback();
    });
    await page.exposeBinding("__zoomAudioChunk", async (source: any, payload: { start: number; end: number; bytes: number[] }) => {
      if (!zoomHost(source.frame.url()) || !this.#emitter || this.#closed) return;
      try {
        if (payload.bytes.length > 8 * 1024 * 1024) throw new CaptureError("recording_limit");
        const chunk: AudioChunk = { sequence: this.#sequence++, start_ms: this.#end, end_ms: this.#end + Math.max(1, payload.end - payload.start), content_type: "audio/webm;codecs=opus", bytes: Uint8Array.from(payload.bytes) };
        this.#end = chunk.end_ms;
        await this.#emitter(chunk);
      } catch (error) { this.#audioError = error; throw error; }
    });
    await page.addInitScript({ content: audioHook });
    await page.goto(target.join_url, { waitUntil: "domcontentloaded", timeout: 20_000 });
    let waiting = false;
    let submitted = false;
    while (true) {
      signal.throwIfAborted();
      if (page.isClosed()) throw new CaptureError("admission_denied");
      const body = await page.locator("body").innerText({ timeout: 3_000 }).catch(() => "");
      if (/invalid passcode|incorrect password|wrong password|пароль неверн|неверный пароль/i.test(body)) throw new CaptureError("authentication_required");
      if (/removed you|host has removed|unable to join|not allowed to join|declined|отклонил|удалил вас/i.test(body)) throw new CaptureError("admission_denied");
      if (/meeting has ended|meeting ended|host ended|встреча завершена/i.test(body)) throw new CaptureError("admission_denied");
      if (/sign in to join|login required|войдите чтобы/i.test(body)) throw new CaptureError("authentication_required");
      if (await page.locator("#wc-footer, [aria-label='Leave Meeting'], [aria-label='Leave meeting']").count()) return;
      if (/waiting for the host|waiting room|host will let you in|зал ожидания|ожидание организатора/i.test(body) && !waiting) { waiting = true; waitingAdmission(); }
      const name = page.locator("input#input-for-name, input[placeholder*='name' i], input[aria-label*='name' i]").first();
      if (await name.count() && await name.isVisible()) await name.fill(display_name);
      const pass = page.locator("input[type='password']").first();
      if (await pass.count() && await pass.isVisible()) {
        if (!this.passcode) throw new CaptureError("authentication_required");
        await pass.fill(this.passcode);
      }
      const web = page.getByRole("button", { name: /join from your browser|join in browser|launch meeting/i }).first();
      if (await web.count() && await web.isVisible()) await web.click();
      const join = page.getByRole("button", { name: /^join( meeting)?$|^присоединиться$/i }).first();
      if (!submitted && await join.count() && await join.isVisible()) { submitted = true; await join.click(); }
      await sleep(pollMs);
    }
  }

  async capture({ signal, stop, emit }: Parameters<CaptureAdapter["capture"]>[0]): Promise<void> {
    const page = this.#page;
    if (!page) throw new CaptureError("adapter_failed");
    this.#emitter = emit;
    let frame: any;
    while (!signal.aborted && !stop.aborted) {
      if (this.#audioError) throw this.#audioError;
      if (page.isClosed()) throw new CaptureError("admission_denied");
      const body = await page.locator("body").innerText({ timeout: 3_000 }).catch(() => "");
      if (/meeting has ended|meeting ended|host ended/i.test(body)) break;
      if (/removed you|host has removed|not allowed to join/i.test(body)) throw new CaptureError("admission_denied");
      if (!frame) {
        for (const candidate of page.frames()) {
          if (!zoomHost(candidate.url())) continue;
          if (await candidate.evaluate(() => (globalThis as any).__zoomAudio?.start()).catch(() => false)) { frame = candidate; break; }
        }
      }
      await sleep(pollMs);
    }
    signal.throwIfAborted();
    if (frame) await frame.evaluate(() => (globalThis as any).__zoomAudio.stop());
    if (this.#audioError) throw this.#audioError;
    this.#emitter = undefined;
  }

  async cleanup(_signal: AbortSignal): Promise<void> {
    this.#closed = true;
    this.#emitter = undefined;
    const page = this.#page;
    if (page && !page.isClosed()) {
      await quiet(async () => page.getByRole("button", { name: /leave meeting|leave/i }).first().click({ timeout: 1000 }));
    }
    let failed = false;
    try { await this.#context?.close(); } catch { failed = true; }
    try { await this.#browser?.close(); } catch { failed = true; }
    this.#page = this.#context = this.#browser = undefined;
    if (failed) throw new CaptureError("cleanup_failed");
  }
  forceCleanup(): void {
    this.#closed = true;
    this.#emitter = undefined;
    void this.#context?.close().catch(() => {});
    void this.#browser?.close().catch(() => {});
    this.#page = this.#context = this.#browser = undefined;
  }
}
