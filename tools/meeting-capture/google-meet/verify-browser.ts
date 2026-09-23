import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import type { BrowserType } from "playwright-core";
import { CaptureError } from "../lifecycle.ts";
import { joinGuest, meetState } from "./browser.ts";

const modulePath = process.env.MEET_VERIFY_PLAYWRIGHT;
if (!modulePath) throw new Error("Set MEET_VERIFY_PLAYWRIGHT to a provisioned playwright-core entry file");
const { chromium } = await import(pathToFileURL(modulePath).href) as { chromium: BrowserType };
const browser = await chromium.launch({ headless: true, ...(process.env.MEET_VERIFY_CHROMIUM ? { executablePath: process.env.MEET_VERIFY_CHROMIUM } : {}) });
try {
  const context = await browser.newContext({ locale: "en-US", serviceWorkers: "block" });
  const page = await context.newPage();
  // A local synthetic HTML fixture, never a live Meet DOM snapshot or a network login.
  await page.setContent(`<label>Your name<input aria-label="Your name"></label>
    <button onclick="this.textContent='Turn on microphone'">Turn off microphone</button>
    <button onclick="this.textContent='Turn on camera'">Turn off camera</button>
    <button id="join">Ask to join</button>
    <script>document.querySelector('#join').onclick=()=>{
      document.body.dataset.name=document.querySelector('input').value;
      document.body.dataset.off=String([...document.querySelectorAll('button')].filter(b=>b.textContent.startsWith('Turn on')).length);
      document.body.innerHTML='<p>Asking to be let in</p>';
      setTimeout(()=>{document.body.innerHTML='<button>Leave call</button>';},250);
    };</script>`);
  let lobby = 0;
  await joinGuest(page, "Test recorder (recording)", AbortSignal.timeout(3_000), () => lobby++);
  assert(lobby > 0);
  assert.equal(await page.locator("body").getAttribute("data-name"), "Test recorder (recording)");
  assert.equal(await page.locator("body").getAttribute("data-off"), "2");
  assert.equal(await meetState(page), "joined");
  console.log("ok: synthetic guest UI sets visible name, mutes camera/mic, asks once, waits for admission");

  for (const [text, code] of [["Your request to join was denied", "admission_denied"], ["You've been removed", "permission_revoked"], ["Sign in to join", "authentication_required"]]) {
    await page.setContent(`<p>${text}</p>`);
    await assert.rejects(meetState(page), error => error instanceof CaptureError && error.code === code);
  }
  await page.setContent('<iframe title="reCAPTCHA"></iframe>');
  await assert.rejects(meetState(page), error => error instanceof CaptureError && error.code === "authentication_required");
  await page.setContent("<p>The meeting has ended</p>");
  assert.equal(await meetState(page), "ended");
  console.log("ok: denial, removal, login, CAPTCHA and ended fixtures classify without bypass");
  await page.setContent("<p>Asking to be let in</p>");
  await assert.rejects(joinGuest(page, "Recorder", AbortSignal.timeout(50), () => {}));
  await page.setContent("<button>Leave call</button>");
  await assert.rejects(joinGuest(page, "Recorder", AbortSignal.timeout(500), () => {}));
  console.log("ok: lobby timeout and unexpected joined session fail closed");
} finally { await browser.close(); }
console.log("Synthetic Playwright fixture checks passed; selectors and real meeting admission remain unverified.");
