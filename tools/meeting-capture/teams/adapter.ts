import type { Browser, BrowserContext, BrowserServer, BrowserType, Page } from "playwright";
import { CaptureError, type CaptureAdapter, type ErrorCode } from "../lifecycle.ts";
import { parseMeetingUrl } from "../url.ts";
import { installAudioBridge } from "./media.ts";
import { approvedDestination } from "./network.ts";

const leave = '[data-inp="hangup-button"], [data-tid="hangup-button"], button[aria-label="Leave"], button[aria-label="Покинуть"]';
const ended = '[data-tid="meeting-ended"], [data-tid="callEnd-screen"], button[data-tid="rejoin-button"], button[data-tid="prejoin-rejoin-button"]';
const nameInput = 'input[data-tid="prejoin-display-name-input"], input[placeholder*="name" i], input[placeholder*="имя" i]';
const browserJoin = 'button[aria-label="Join meeting from this browser"], button:has-text("Join from browser"), button:has-text("Continue on this browser"), button:has-text("Присоединиться из браузера"), button:has-text("Продолжить в этом браузере")';
const joinNow = 'button[data-tid="prejoin-join-button"], button:has-text("Join now"), button:has-text("Присоединиться сейчас")';
type PageState = "unknown" | "lobby" | "admitted" | "ended" | "denied" | "auth" | "forbidden";

export type TeamsOptions = {
  chromium: BrowserType;
  /** These attestations come from trusted orchestration, never an untrusted form. */
  authorization: { meeting_authorized: true; recording_notice_confirmed: true; platform_recording_allowed: true; isolated_network_confirmed: true };
  channel?: "chrome" | "chromium";
  headless?: boolean;
};

/** One fresh browser process/profile per attempt. Guest join only, no saved login. */
export class TeamsAdapter implements CaptureAdapter {
  readonly platform = "teams" as const;
  readonly capabilities = { joins_as_participant: true, provides_mixed_audio: true, provides_participant_audio: false } as const;
  #server?: BrowserServer;
  #browser?: Browser;
  #context?: BrowserContext;
  #page?: Page;
  #closed = false;
  #used = false;
  #admitted = false;
  #networkError?: ErrorCode;

  constructor(private readonly options: TeamsOptions) {
    const auth = options.authorization;
    if (!auth || [auth.meeting_authorized, auth.recording_notice_confirmed, auth.platform_recording_allowed,
      auth.isolated_network_confirmed].some(value => value !== true) || process.platform === "win32") {
      throw new Error("invalid_teams_authorization_or_runtime");
    }
  }

  async #state(): Promise<PageState> {
    const page = this.#page!;
    if (this.#networkError) throw new CaptureError(this.#networkError);
    if (page.isClosed()) throw new CaptureError("media_unavailable");
    // Read only status prompts. No page contents, meeting links, screenshots or
    // raw browser errors are returned/logged outside this process.
    return page.evaluate(({ leave, ended }) => {
      const visible = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)]
        .some(element => element.getClientRects().length && getComputedStyle(element).visibility !== "hidden");
      const body = document.body?.innerText.toLowerCase() ?? "";
      if (/recording (is )?(not allowed|disabled|prohibited)|запись запрещена|запись недоступна/.test(body)) return "forbidden";
      if (/denied access to the meeting|you were denied|отказано в доступе|вам отказано/.test(body)) return "denied";
      if (/we need to verify your info|verify your info before|sign in to join|captcha|verify you are human|необходимо проверить ваши данные|нужно подтвердить вашу личность|войдите.*присоедин/.test(body)
        || visible('input[type="password"], input[type="email"], iframe[src*="captcha"]')) return "auth";
      if (visible(ended)) return "ended";
      if (/someone will let you in|waiting for others to admit|when the meeting starts, we'll let people know|кто-то на собрании должен вас впустить|ожидайте, пока вас впустят|когда собрание начнется, мы сообщим/.test(body)) return "lobby";
      return visible(leave) ? "admitted" : "unknown";
    }, { leave, ended });
  }

  #check(signal: AbortSignal) {
    signal.throwIfAborted();
    if (this.#closed) throw new CaptureError("cancelled");
    if (this.#networkError) throw new CaptureError(this.#networkError);
  }
  async #pause(signal: AbortSignal) {
    this.#check(signal);
    await new Promise<void>(resolve => setTimeout(resolve, 150));
    this.#check(signal);
  }
  #rejectState(state: PageState) {
    if (state === "denied") throw new CaptureError("admission_denied");
    if (state === "auth") throw new CaptureError("authentication_required");
    if (state === "forbidden") throw new CaptureError("permission_revoked");
  }

  async join({ target, display_name, signal, waitingAdmission }: Parameters<CaptureAdapter["join"]>[0]) {
    this.#check(signal);
    if (this.#used || target.platform !== "teams" || parseMeetingUrl(target.join_url).platform !== "teams" || !display_name.trim()
      || display_name.length > 120 || /[\x00-\x1f\x7f]/.test(display_name)) throw new CaptureError("adapter_failed");
    this.#used = true;
    try {
      const server = await this.options.chromium.launchServer({ headless: this.options.headless ?? true,
        channel: this.options.channel ?? "chrome", host: "127.0.0.1", timeout: 20_000,
        args: ["--autoplay-policy=no-user-gesture-required"] });
      this.#server = server;
      if (signal.aborted || this.#closed) { this.forceCleanup(); signal.throwIfAborted(); throw new CaptureError("cancelled"); }
      this.#browser = await this.options.chromium.connect(server.wsEndpoint());
      this.#check(signal);
      this.#context = await this.#browser.newContext({ locale: "en-US", serviceWorkers: "block", acceptDownloads: false });
      this.#check(signal);
      this.#context.setDefaultTimeout(2500);
      await this.#context.route("**/*", async route => {
        const request = route.request();
        const url = request.url();
        if (/^https:\/\/(login\.microsoftonline\.com|login\.live\.com|account\.live\.com)\//i.test(url) && request.isNavigationRequest()) {
          this.#networkError = "authentication_required";
          await route.abort(); return;
        }
        if (this.#closed || !await approvedDestination(url, request.isNavigationRequest()) || this.#closed) {
          if (request.isNavigationRequest()) this.#networkError = "permission_revoked";
          await route.abort(); return;
        }
        await route.continue();
      });
      await this.#context.routeWebSocket("**/*", async socket => {
        if (this.#closed || !await approvedDestination(socket.url(), false, true) || this.#closed) { socket.close(); return; }
        socket.connectToServer();
      });
      await this.#context.addInitScript(installAudioBridge);
      this.#check(signal);
      this.#page = await this.#context.newPage();
      this.#context.on("page", page => { if (page !== this.#page) { this.#networkError = "permission_revoked"; void page.close().catch(() => {}); } });
      // Never request/grant microphone or camera permissions, copy profiles,
      // hide automation, set launcher bypass flags or guess authenticated join.
      await this.#page.goto(target.join_url, { waitUntil: "domcontentloaded", timeout: 20_000 });
      let submitted = false;
      let named = false;
      let lobby = false;
      while (true) {
        this.#check(signal);
        const state = await this.#state();
        this.#rejectState(state);
        if (state === "ended") throw new CaptureError("admission_denied");
        if (state === "admitted") {
          if (!submitted || !named) throw new CaptureError("permission_revoked");
          this.#admitted = true;
          return;
        }
        if (state === "lobby") { if (!lobby) { lobby = true; waitingAdmission(); } }
        else if (!submitted) {
          const browserButton = this.#page.locator(browserJoin).first();
          if (await browserButton.isVisible()) { this.#check(signal); await browserButton.click(); }
          const name = this.#page.locator(nameInput).first();
          if (await name.isVisible()) {
            this.#check(signal);
            await name.fill(display_name.trim());
            named = await name.inputValue() === display_name.trim();
            for (const selector of ['button[aria-label="Turn camera off"], button[aria-label="Выключить камеру"]',
              'button[aria-label="Mute"], button[aria-label="Mute microphone"], button[aria-label="Выключить микрофон"]']) {
              const toggle = this.#page.locator(selector).first();
              if (await toggle.isVisible()) { this.#check(signal); await toggle.click(); }
            }
            const button = this.#page.locator(joinNow).first();
            if (named && await button.isVisible()) { this.#check(signal); await button.click(); submitted = true; }
          }
        }
        await this.#pause(signal);
      }
    } catch (error) {
      if (this.#networkError) throw new CaptureError(this.#networkError);
      if (error instanceof CaptureError) throw error;
      if (signal.aborted) throw signal.reason;
      throw new CaptureError("adapter_failed");
    }
  }

  async capture({ signal, stop, emit }: Parameters<CaptureAdapter["capture"]>[0]) {
    if (!this.#admitted || !this.#page) throw new CaptureError("media_unavailable");
    const page = this.#page;
    const mediaDeadline = Date.now() + 15_000;
    while (true) {
      this.#check(signal);
      const state = await this.#state(); this.#rejectState(state);
      if (stop.aborted || state === "ended" || state === "lobby") throw new CaptureError("media_unavailable");
      if (await page.evaluate(() => window.__localMeetingAudio.start())) break;
      if (Date.now() >= mediaDeadline) throw new CaptureError("media_unavailable");
      await this.#pause(signal);
    }
    let sequence = 0;
    let end = 0;
    let draining = false;
    let unknownSince = 0;
    let noTracksSince = 0;
    while (true) {
      this.#check(signal);
      const state = await this.#state(); this.#rejectState(state);
      if (state === "lobby") throw new CaptureError("permission_revoked");
      if (state === "unknown") {
        unknownSince ||= Date.now();
        if (Date.now() - unknownSince > 5000) throw new CaptureError("media_unavailable");
      } else unknownSince = 0;
      if (!draining && (stop.aborted || state === "ended")) {
        draining = true;
        await page.evaluate(() => window.__localMeetingAudio.stop());
      }
      const next = await page.evaluate(() => window.__localMeetingAudio.next());
      if (next.error) throw new CaptureError("media_unavailable");
      if (!next.has_tracks && !draining) {
        noTracksSince ||= Date.now();
        if (Date.now() - noTracksSince > 5000) throw new CaptureError("media_unavailable");
      } else noTracksSince = 0;
      if (next.part) {
        this.#check(signal);
        await emit({ sequence, start_ms: end, end_ms: next.part.end_ms,
          content_type: "audio/webm;codecs=opus", bytes: new Uint8Array(Buffer.from(next.part.base64, "base64")) });
        end = next.part.end_ms; sequence++;
      } else if (next.stopped) {
        if (!draining) throw new CaptureError("media_unavailable");
        return;
      } else await this.#pause(signal);
    }
  }

  async cleanup(signal: AbortSignal) {
    try {
      signal.throwIfAborted();
      if (this.#page && !this.#page.isClosed()) {
        await this.#page.evaluate(() => window.__localMeetingAudio?.dispose());
        signal.throwIfAborted();
        const button = this.#page.locator(leave).first();
        if (await button.isVisible()) {
          await button.click();
          await button.waitFor({ state: "hidden", timeout: 2500 });
        }
      }
    } finally {
      try { await this.#server?.close(); }
      finally { this.forceCleanup(); }
    }
  }

  forceCleanup() {
    this.#closed = true;
    const child = this.#server?.process();
    // Playwright's POSIX launcher creates an owned process group. Never kill
    // other browser instances. The runtime pin and proof verify this assumption.
    if (child?.pid && child.exitCode === null && child.signalCode === null) {
      try { process.kill(-child.pid, "SIGKILL"); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw new CaptureError("cleanup_failed"); }
    }
    void this.#server?.close().catch(() => {});
  }
}
