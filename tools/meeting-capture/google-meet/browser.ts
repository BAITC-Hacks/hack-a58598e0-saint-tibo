import type { BrowserContext, Page } from "playwright-core";
import { CaptureError } from "../lifecycle.ts";
import { poll } from "./process.ts";

const resourceHosts = new Set(["meet.google.com", "www.gstatic.com", "ssl.gstatic.com", "fonts.gstatic.com",
  "fonts.googleapis.com", "lh3.googleusercontent.com", "meetings.clients6.google.com",
  "meet.googleapis.com", "clients6.google.com", "accounts.google.com", "apis.google.com"]);

/** Exact names only; never arbitrary google subdomains, user URLs, IPs or non-HTTPS. */
export function allowedDestination(raw: string, meetingUrl: string, navigation = false) {
  try {
    const url = new URL(raw), meeting = new URL(meetingUrl);
    if (url.protocol !== "https:" || url.port || url.username || url.password) return false;
    return navigation ? url.origin === meeting.origin && url.pathname === meeting.pathname : resourceHosts.has(url.hostname);
  } catch { return false; }
}

export async function restrictNetwork(context: BrowserContext, page: Page, meetingUrl: string, fail: (error: CaptureError) => void) {
  await context.route("**/*", async route => {
    try {
      const request = route.request();
      const navigation = request.isNavigationRequest() && request.frame() === page.mainFrame();
      if (!allowedDestination(request.url(), meetingUrl, navigation)) {
        if (navigation) fail(new CaptureError(request.url().startsWith("https://accounts.google.com/") ? "authentication_required" : "permission_revoked"));
        await route.abort("blockedbyclient");
        return;
      }
      // route.continue may follow redirects without re-entering routing. Refuse ALL
      // redirects before Chromium can follow them, including subresource redirects.
      const response = await route.fetch({ maxRedirects: 0, maxRetries: 0, timeout: 20_000 });
      if (response.status() >= 300 && response.status() < 400) {
        if (navigation) fail(new CaptureError("authentication_required"));
        await route.abort("blockedbyclient");
      } else await route.fulfill({ response });
      await response.dispose();
    } catch {
      fail(new CaptureError("adapter_failed"));
      await route.abort().catch(() => {});
    }
  });
  // This prototype uses Meet's HTTPS signalling. Unknown socket transports fail closed.
  await context.routeWebSocket("**/*", socket => { socket.close(); fail(new CaptureError("permission_revoked")); });
  context.on("page", popup => {
    if (popup !== page) { fail(new CaptureError("permission_revoked")); void popup.close().catch(() => {}); }
  });
  page.on("download", download => { fail(new CaptureError("permission_revoked")); void download.cancel().catch(() => {}); });
}

async function visible(page: Page, text: RegExp) {
  return page.getByText(text).first().isVisible();
}

/** Ordinary English guest UI only; no captions, private APIs, login or challenge handlers. */
export async function meetState(page: Page): Promise<"prejoin" | "lobby" | "joined" | "ended" | "unknown"> {
  if (page.isClosed()) throw new CaptureError("media_unavailable");
  if (page.url().startsWith("https://accounts.google.com/")
      || await visible(page, /^(Sign in to join|You need to sign in|Sign in to Google Meet)/i)
      || await page.locator('iframe[title*="reCAPTCHA"], iframe[title*="challenge"]').first().isVisible()) throw new CaptureError("authentication_required");
  if (await visible(page, /^(You can't join this (video )?call|Your request to join was denied|Someone denied your request|You were denied)/i)) throw new CaptureError("admission_denied");
  if (await visible(page, /^(You've been removed|You have been removed|You can't rejoin)/i)) throw new CaptureError("permission_revoked");
  if (await visible(page, /^(The meeting has ended|This meeting has ended|You left the meeting|You left the call|The meeting code you entered doesn't work)/i)) return "ended";
  if (await page.getByRole("button", { name: /^Leave call(?:\s|$)/i }).first().isVisible()) return "joined";
  if (await visible(page, /^(Asking to be let in|Someone in the (meeting|call) should let you in soon|You'll join the call when someone lets you in)/i)) return "lobby";
  if (await page.getByRole("textbox", { name: /Your name/i }).first().isVisible()) return "prejoin";
  return "unknown";
}

export async function joinGuest(page: Page, name: string, signal: AbortSignal, waitingAdmission: () => void) {
  let requested = false;
  await poll(async () => {
    const state = await meetState(page);
    if (state === "ended") throw new CaptureError("admission_denied");
    if (state === "joined") {
      // A fresh guest must have passed through the named prejoin step.
      if (!requested) throw new CaptureError("permission_revoked");
      return true;
    }
    if (state === "lobby") { waitingAdmission(); return false; }
    if (state === "prejoin" && !requested) {
      signal.throwIfAborted();
      await page.getByRole("textbox", { name: /Your name/i }).first().fill(name, { timeout: 2_000 });
      for (const device of ["microphone", "camera"]) {
        const off = page.getByRole("button", { name: new RegExp(`^Turn off ${device}`, "i") }).first();
        if (await off.isVisible()) await off.click({ timeout: 2_000 });
      }
      const without = page.getByRole("button", { name: /^Continue without microphone and camera$/i }).first();
      if (await without.isVisible()) await without.click({ timeout: 2_000 });
      const micOff = await page.getByRole("button", { name: /^Turn on microphone/i }).first().isVisible();
      const cameraOff = await page.getByRole("button", { name: /^Turn on camera/i }).first().isVisible();
      // No guessed toggles or browser permission auto-grants. Operator may resolve the ordinary prompt.
      if (!micOff || !cameraOff) return false;
      signal.throwIfAborted();
      await page.getByRole("button", { name: /^(Ask to join|Join now)$/i }).first().click({ timeout: 2_000 });
      requested = true;
      waitingAdmission();
    }
    return false;
  }, signal);
}
