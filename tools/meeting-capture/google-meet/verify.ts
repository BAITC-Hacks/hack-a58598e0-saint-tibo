import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { CaptureSession, CaptureError, type CaptureAdapter, type AudioChunk } from "../lifecycle.ts";
import { allowedDestination } from "./browser.ts";
import { captureProcess, emitOgg, opusOutputArgs } from "./audio.ts";
import { OwnedProcess } from "./process.ts";
import { GoogleMeetAdapter } from "./adapter.ts";

const ffmpeg = process.env.MEET_VERIFY_FFMPEG;
if (!ffmpeg) throw new Error("Set MEET_VERIFY_FFMPEG to an installed FFmpeg with libopus (no downloads in this script)");
const deadline = AbortSignal.timeout(30_000);
let checks = 0;
const ok = (text: string) => console.log(`ok ${++checks}: ${text}`);
const target = "https://meet.google.com/abc-defg-hij";
assert(allowedDestination(target, target, true));
for (const url of ["http://meet.google.com/abc-defg-hij", "https://meet.google.com.evil.test/", "https://127.0.0.1/", "https://169.254.169.254/", "https://[::1]/", "https://meet.google.com:444/", "https://x@meet.google.com/", "file:///etc/passwd", "https://other.googleapis.com/", "https://accounts.google.com/"]) {
  assert(!allowedDestination(url, target, true));
}
assert(!allowedDestination("https://127.0.0.1/", target));
assert(!allowedDestination("https://meet.google.com.evil.test/", target));
assert(allowedDestination("https://www.gstatic.com/asset.js", target));
ok("destination policy rejects private/IP/credential/port/suffix targets and off-meeting navigation");

const options = { chromium: "/missing/chromium", pulseaudio: "/missing/pulse", ffmpeg, playwright_module: "/missing/playwright.js", recording_notice_confirmed: true, network_isolation_confirmed: true };
assert.throws(() => new GoogleMeetAdapter({ ...options, recording_notice_confirmed: false }));
assert.throws(() => new GoogleMeetAdapter({ ...options, network_isolation_confirmed: false }));
const cancelled = new AbortController(); cancelled.abort(new CaptureError("cancelled"));
const unopened = new GoogleMeetAdapter(options);
await assert.rejects(unopened.join({ target: { platform: "google_meet", join_url: target }, display_name: "Recorder", signal: cancelled.signal, waitingAdmission() {} }));
unopened.forceCleanup(); unopened.forceCleanup();
ok("notice and runner isolation are mandatory; pre-aborted join creates no resource; cleanup is idempotent");

function encode(filter: string, seconds: string) {
  const result = spawnSync(ffmpeg!, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", filter, "-t", seconds, ...opusOutputArgs], { maxBuffer: 4 * 1024 * 1024, timeout: 10_000 });
  assert.equal(result.status, 0, "FFmpeg synthetic encode failed");
  return result.stdout;
}
const tone = encode("sine=frequency=440:sample_rate=48000", "12.25");
async function* fragments(bytes: Buffer, size = 37) {
  for (let offset = 0; offset < bytes.length; offset += size) yield bytes.subarray(offset, offset + size);
}
const chunks: AudioChunk[] = [];
await emitOgg(fragments(tone), async chunk => { await delay(1); chunks.push(chunk); }, deadline);
assert(chunks.length >= 2);
assert.deepEqual(Buffer.concat(chunks.map(chunk => Buffer.from(chunk.bytes))), tone);
for (const [index, chunk] of chunks.entries()) {
  assert.equal(chunk.sequence, index);
  assert.equal(chunk.start_ms, index ? chunks[index - 1]!.end_ms : 0);
  assert(chunk.end_ms > chunk.start_ms);
}
assert.equal(chunks.at(-1)!.end_ms, 12_250);
const decoded = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-f", "f32le", "-acodec", "pcm_f32le", "pipe:1"], { input: tone, maxBuffer: 4 * 1024 * 1024, timeout: 10_000 });
assert.equal(decoded.status, 0);
assert.equal(decoded.stdout.length / 4, 12.25 * 48_000);
let sum = 0;
for (let offset = 0; offset < decoded.stdout.length; offset += 4) sum += decoded.stdout.readFloatLE(offset) ** 2;
assert(Math.sqrt(sum / (decoded.stdout.length / 4)) > 0.05);
ok("real FFmpeg tone: arbitrarily split stdout -> continuous Opus chunks -> exact 12.25s PCM with nonzero RMS");

await assert.rejects(emitOgg(fragments(tone.subarray(0, tone.length - 12)), async () => {}, deadline), CaptureError);
await assert.rejects(emitOgg(fragments(Buffer.concat([tone, tone])), async () => {}, deadline), CaptureError);
await assert.rejects(emitOgg(fragments(Buffer.from("not an ogg stream")), async () => {}, deadline), CaptureError);
ok("truncation, a second container and invalid bytes cannot finalize successfully");
const silentChunks: AudioChunk[] = [];
await emitOgg(fragments(encode("anullsrc=r=48000:cl=mono", "0.25")), async chunk => { silentChunks.push(chunk); }, deadline);
assert.equal(silentChunks[0]!.end_ms, 250);
ok("short/silent stream is format-valid; no false claim that a valid container proves audible meeting audio");

function encoder(realtime = false) {
  return new OwnedProcess(ffmpeg!, ["-hide_banner", "-loglevel", "error", ...(realtime ? ["-re"] : []), "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000", "-t", "20", ...opusOutputArgs], process.env, true);
}
const graceful = encoder(true), stop = new AbortController();
const timer = setTimeout(() => stop.abort(), 1_300);
const finalChunks: AudioChunk[] = [];
try { await captureProcess(graceful, { signal: deadline, stop: stop.signal, emit: async chunk => { finalChunks.push(chunk); } }); }
finally { clearTimeout(timer); graceful.kill(); }
assert(finalChunks.length > 0);
assert(graceful.exited);
assert(finalChunks.at(-1)!.end_ms < 20_000);
ok("stdin quit gracefully drains the real FFmpeg process and final EOS/audio tail");
const broken = encoder(true), abort = new AbortController();
const killTimer = setTimeout(() => abort.abort(new CaptureError("cancelled")), 200);
try { await assert.rejects(captureProcess(broken, { signal: abort.signal, stop: new AbortController().signal, emit: async () => {} })); }
finally { clearTimeout(killTimer); broken.kill(); }
await broken.done;
assert(broken.exited);
ok("abort kills the encoder, rejects capture and releases stdout");
const missing = new OwnedProcess("/nonexistent/meet24-encoder", [], process.env);
await assert.rejects(captureProcess(missing, { signal: deadline, stop: new AbortController().signal, emit: async () => {} }));
assert((await missing.done).failed);
ok("spawn failure is contained without an unhandled process error");

const family = new OwnedProcess(process.execPath, ["-e", "const {spawn}=require('node:child_process'); const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'}); console.log(c.pid); setInterval(()=>{},1000);"], process.env);
let descendant = 0;
for await (const bytes of family.child.stdout!) { descendant = Number(String(bytes).trim()); if (descendant) break; }
family.kill(); family.kill(); await family.done;
await delay(100);
assert.throws(() => process.kill(descendant, 0), /ESRCH/);
ok("forced cleanup kills the owned parent and descendant process group, twice safely");

let cleaned = false, finalized = false;
const synthetic: CaptureAdapter = {
  platform: "google_meet", capabilities: { joins_as_participant: true, provides_mixed_audio: true, provides_participant_audio: false },
  async join(context) { context.waitingAdmission(); },
  async capture(context) { await emitOgg(fragments(tone), context.emit, context.signal); },
  async cleanup() { cleaned = true; }, forceCleanup() {},
};
const received: AudioChunk[] = [];
const session = new CaptureSession({ id: "00000000-0000-4000-8000-000000000001", meeting_id: "00000000-0000-4000-8000-000000000002", recording_id: "00000000-0000-4000-8000-000000000003", meeting_url: target, display_name: "Local verifier", recording_notice_confirmed: true }, synthetic, {
  async write(chunk) { received.push(chunk); },
  async finalize(body) { assert(cleaned); assert(body.is_complete); assert.equal(body.expected_chunks, received.length); finalized = true; },
});
assert.equal((await session.start()).status, "completed");
assert(finalized);
ok("encoded audio crosses the actual shared CaptureSession/AudioSink with contiguous metadata and acknowledged finalize");
console.log(`Synthetic verification passed: ${checks} checks. No live Meet, browser UI, Linux PulseAudio, backend or player acceptance claimed.`);
