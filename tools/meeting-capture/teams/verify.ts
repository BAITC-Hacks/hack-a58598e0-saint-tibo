import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, type BrowserType, type BrowserServer, type Page } from "playwright";
import { CaptureSession, type AudioChunk } from "../lifecycle.ts";
import { TeamsAdapter, type TeamsOptions } from "./adapter.ts";
import { approvedUrl } from "./network.ts";

const output = fileURLToPath(new URL(".proof/", import.meta.url));
const html = await readFile(new URL("fixture.html", import.meta.url), "utf8");
const authorization: TeamsOptions["authorization"] = { meeting_authorized: true, recording_notice_confirmed: true,
  platform_recording_allowed: true, isolated_network_confirmed: true };
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const input = () => ({ id: crypto.randomUUID(), meeting_id: crypto.randomUUID(), recording_id: crypto.randomUUID(),
  meeting_url: "https://teams.microsoft.com/meet/1234567890123", display_name: "Local recorder (notice confirmed)",
  recording_notice_confirmed: true, timeouts: { join_ms: 15_000, admission_ms: 1800, duration_ms: 20_000, cleanup_ms: 6000 } });

assert(!approvedUrl("https://teams.microsoft.com.evil.test/meet/1234567890123"));
assert(!approvedUrl("https://127.0.0.1/"));
assert(!approvedUrl("https://teams.microsoft.com:444/"));
assert(!approvedUrl("http://teams.microsoft.com/"));
assert(!approvedUrl("https://login.microsoftonline.com/", true));
assert(approvedUrl("https://teams.microsoft.com/", true));
assert(approvedUrl("wss://media.teams.microsoft.com/", false, true));
assert.throws(() => new TeamsAdapter({ chromium, authorization: { ...authorization, meeting_authorized: false } as unknown as TeamsOptions["authorization"] }));

async function run(mode: string, action: "stop" | "cancel" | "none" = "none", failSink = false) {
  const servers: BrowserServer[] = [];
  let page: Page | undefined;
  let named = false;
  let left = false;
  // Trusted test fixture only: replace network routes at the Playwright boundary.
  // Production adapter never accepts localhost or a synthetic input option.
  const driver = new Proxy(chromium, { get(target, property) {
    if (property === "launchServer") return async (options: Parameters<BrowserType["launchServer"]>[0]) => {
      const server = await target.launchServer(options); servers.push(server); return server;
    };
    if (property === "connect") return async (endpoint: string) => {
      const browser = await target.connect(endpoint);
      const newContext = browser.newContext.bind(browser);
      browser.newContext = async options => {
        const context = await newContext(options);
        const route = context.route.bind(context);
        context.route = async () => route("**/*", async request => {
          if (request.request().isNavigationRequest() && request.request().url() === input().meeting_url) {
            await request.fulfill({ contentType: "text/html", body: html.replace("|| 'normal'", `|| '${mode}'`) });
          } else await request.abort();
        });
        const newPage = context.newPage.bind(context);
        context.newPage = async () => {
          page = await newPage();
          await page.exposeFunction("fixtureResult", (result: { named: boolean; left: boolean }) => {
            named ||= result.named; left ||= result.left;
          });
          await page.addInitScript(() => {
            setInterval(() => {
              const state = (window as unknown as { fixture?: { named: boolean; left: boolean } }).fixture;
              if (state) void (window as unknown as { fixtureResult(result: typeof state): Promise<void> }).fixtureResult(state);
            }, 20);
          });
          return page;
        };
        return context;
      };
      return browser;
    };
    const value = Reflect.get(target, property);
    return typeof value === "function" ? value.bind(target) : value;
  } });
  const chunks: AudioChunk[] = [];
  let finalized: { expected_chunks: number; is_complete: boolean } | undefined;
  const request = input();
  if (mode === "stuck-leave") request.timeouts.cleanup_ms = 300;
  const session = new CaptureSession(request, new TeamsAdapter({ chromium: driver, authorization }), {
    async write(chunk) { if (failSink) throw new Error("synthetic_sink_failure"); chunks.push(chunk); },
    async finalize(body) { finalized = body; },
  });
  let lobby = false;
  const done = session.start();
  const observe = setInterval(() => { lobby ||= session.snapshot.status === "waiting_admission"; }, 25);
  let actionTask: Promise<void> | undefined;
  if (action !== "none") actionTask = (async () => {
    while (session.snapshot.status !== "recording" && !session.snapshot.ended_at) await pause(25);
    if (!session.snapshot.ended_at) {
      await pause(5400);
      if (action === "stop") await session.stop(); else await session.cancel();
    }
  })();
  let result;
  try { result = await done; await actionTask; }
  finally { clearInterval(observe); }
  assert(lobby, `${mode}: lobby observed`);
  assert(named, `${mode}: explicit participant name`);
  for (const server of servers) {
    const child = server.process();
    if (child.exitCode === null && child.signalCode === null) await new Promise(resolve => child.once("exit", resolve));
    assert(child.exitCode !== null || child.signalCode !== null, `${mode}: browser process exited`);
    assert.throws(() => process.kill(-child.pid!, 0), `${mode}: process group removed`);
  }
  // SIGKILL is synchronous to request, but Playwright reports close after its
  // transport observes process exit. Bound that observation instead of racing it.
  const closedBy = Date.now() + 2000;
  while (!page?.isClosed() && Date.now() < closedBy) await pause(20);
  assert(page?.isClosed(), `${mode}: page closed`);
  if (result.status === "completed") {
    assert(finalized?.is_complete); assert(chunks.length >= 2, "stream and final drain");
    assert.equal(finalized.expected_chunks, chunks.length);
    if (action === "stop") assert(left, "leave confirmed before browser teardown");
  } else if (chunks.length) assert.equal(finalized?.is_complete, false);
  else assert.equal(finalized, undefined);
  console.log(JSON.stringify({ scenario: mode + ":" + action + (failSink ? ":sink-failure" : ""), status: result.status,
    error_code: result.error_code, chunks: chunks.length, lobby, browser_closed: true }));
  return { result, chunks, left };
}

await mkdir(output, { recursive: true, mode: 0o700 });
const normal = await run("normal", "stop");
assert.equal(normal.result.status, "completed");
// Leave click is additionally confirmed by the fixture's post-call DOM wait.
const media = Buffer.concat(normal.chunks.map(chunk => Buffer.from(chunk.bytes)));
await writeFile(output + "synthetic.webm", media, { mode: 0o600 });

// Decode locally in another isolated browser. Check both incoming frequencies
// survived and unrelated tab output did not. Produce PCM WAV for manual playback.
const decoder = await chromium.launch({ channel: "chrome", headless: true });
let decoded;
try {
  const page = await decoder.newPage();
  decoded = await page.evaluate(async base64 => {
    const raw = Uint8Array.from(atob(base64), value => value.charCodeAt(0));
    const audio = new AudioContext();
    const decoded = await audio.decodeAudioData(raw.buffer);
    const samples = decoded.getChannelData(0);
    const strength = (frequency: number) => {
      let sin = 0; let cos = 0; const start = Math.floor(decoded.sampleRate);
      const count = Math.min(decoded.sampleRate, samples.length - start);
      for (let i = 0; i < count; i++) {
        sin += samples[start + i]! * Math.sin(2 * Math.PI * frequency * i / decoded.sampleRate);
        cos += samples[start + i]! * Math.cos(2 * Math.PI * frequency * i / decoded.sampleRate);
      }
      return 2 * Math.hypot(sin, cos) / count;
    };
    const pcm = new Uint8Array(samples.length * 2);
    const view = new DataView(pcm.buffer);
    samples.forEach((value, index) => view.setInt16(index * 2, Math.max(-1, Math.min(1, value)) * 32767, true));
    let binary = "";
    for (let i = 0; i < pcm.length; i += 8192) binary += String.fromCharCode(...pcm.subarray(i, i + 8192));
    const result = { duration: decoded.duration, sampleRate: decoded.sampleRate, first: strength(440), second: strength(660),
      unrelated: strength(880), pcm: btoa(binary) };
    await audio.close(); return result;
  }, media.toString("base64"));
} finally { await decoder.close(); }
assert(decoded.duration > 4 && decoded.duration < 8);
assert(decoded.first > 0.02 && decoded.second > 0.02, "both remote audio sources audible");
assert(decoded.unrelated < Math.min(decoded.first, decoded.second) / 10, "unrelated output excluded");
const pcm = Buffer.from(decoded.pcm, "base64");
const header = Buffer.alloc(44);
header.write("RIFF"); header.writeUInt32LE(36 + pcm.length, 4); header.write("WAVEfmt ", 8);
header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
header.writeUInt32LE(decoded.sampleRate, 24); header.writeUInt32LE(decoded.sampleRate * 2, 28);
header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write("data", 36); header.writeUInt32LE(pcm.length, 40);
await writeFile(output + "synthetic.wav", Buffer.concat([header, pcm]), { mode: 0o600 });
console.log(JSON.stringify({ audio_proof: "two remote tones, unrelated output excluded", duration_seconds: decoded.duration,
  amplitude_440: decoded.first, amplitude_660: decoded.second, amplitude_880: decoded.unrelated,
  sha256: createHash("sha256").update(media).digest("hex") }));

for (const [mode, expected] of [["denied", "admission_denied"], ["auth", "authentication_required"],
  ["forbidden", "permission_revoked"], ["timeout", "admission_timeout"], ["no-media", "media_unavailable"],
  ["revoked", "permission_revoked"], ["lost-media", "media_unavailable"]] as const) {
  assert.equal((await run(mode)).result.error_code, expected);
}
assert.equal((await run("ended")).result.status, "completed");
assert.equal((await run("normal", "cancel")).result.status, "cancelled");
assert.equal((await run("normal", "none", true)).result.error_code, "upload_failed");
assert.equal((await run("stuck-leave", "stop")).result.error_code, "cleanup_timeout");
console.log("Synthetic Teams adapter proof passed. Real Teams join, tenant policy and backend/player acceptance remain unverified.");
