// Bounded synthetic proof only: no platform login, HTTP, files, microphone or cloud processing.
import { strict as assert } from "node:assert";
import { CaptureError, CaptureSession, type AudioChunk, type AudioSink, type CaptureAdapter } from "./lifecycle.ts";
import { parseMeetingUrl } from "./url.ts";

let checks = 0;
const input = {
  id: "00000000-0000-4000-8000-000000000001", meeting_id: "00000000-0000-4000-8000-000000000002",
  recording_id: "00000000-0000-4000-8000-000000000003", meeting_url: "https://meet.google.com/abc-defg-hij",
  display_name: "Synthetic recorder", recording_notice_confirmed: true,
  timeouts: { join_ms: 30, admission_ms: 30, duration_ms: 100, stop_ms: 30, io_ms: 30, cleanup_ms: 30 },
};
const chunk = (sequence = 0): AudioChunk => ({ sequence, start_ms: sequence * 10, end_ms: (sequence + 1) * 10, content_type: "audio/webm;codecs=opus", bytes: new Uint8Array([1, 2, 3]) });
const hang = () => new Promise<void>(() => {});
const aborted = (signal: AbortSignal) => signal.aborted ? Promise.resolve() : new Promise<void>(resolve => signal.addEventListener("abort", () => resolve(), { once: true }));
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 1));
function fixture(overrides: Partial<CaptureAdapter> = {}, sinkOverrides: Partial<AudioSink> = {}) {
  const events: string[] = [];
  const finals: { expected_chunks: number; is_complete: boolean }[] = [];
  let cleanupCount = 0;
  let forceCount = 0;
  let ownedResource = false;
  const adapter: CaptureAdapter = {
    platform: "google_meet", capabilities: { joins_as_participant: true, provides_mixed_audio: true, provides_participant_audio: false },
    async join() { ownedResource = true; events.push("join"); },
    async capture({ emit }) { events.push("capture"); await emit(chunk()); },
    async cleanup(signal) { assert.equal(signal.aborted, false); events.push("cleanup"); cleanupCount++; },
    forceCleanup() { events.push("force"); forceCount++; ownedResource = false; },
    ...overrides,
  };
  const sink: AudioSink = { async write() { events.push("write"); }, async finalize(body) { events.push("finalize"); finals.push(body); }, ...sinkOverrides };
  const session = new CaptureSession(input, adapter, sink);
  return { session, events, finals, get cleanupCount() { return cleanupCount; }, get forceCount() { return forceCount; }, get ownedResource() { return ownedResource; } };
}
async function proof(name: string, run: () => void | Promise<void>) {
  await run(); checks++; console.log(`ok ${checks}: ${name}`);
}

await proof("URL allowlist and safe normalization", () => {
  assert.deepEqual(parseMeetingUrl("https://MEET.GOOGLE.COM/ABC-DEFG-HIJ/?hs=1&authuser=0"), { platform: "google_meet", join_url: input.meeting_url });
  assert.equal(parseMeetingUrl("https://us02web.zoom.us/j/12345678901?pwd=PrivateToken").platform, "zoom");
  assert.equal(parseMeetingUrl("https://teams.microsoft.com/l/meetup-join/19%3ameeting_ABC%40thread.v2/0").platform, "teams");
  assert.equal(parseMeetingUrl("https://teams.microsoft.com/meet/123456789012?p=PrivateToken").platform, "teams");
  assert.equal(parseMeetingUrl("https://teams.live.com/meet/123456789012?p=PrivateToken").platform, "teams");
  const invalid = ["http://meet.google.com/abc-defg-hij", "https://meet.google.com.evil.test/abc-defg-hij", "https://evilmeet.google.com/abc-defg-hij",
    "https://zoom.us.evil.test/j/123456789", "https://a.b.zoom.us/j/123456789", "https://zoom.us/wc/123456789/join",
    "https://zoom.us/j/1", "https://zoom.us/j/123456789?pwd=a&pwd=b", "https://zoom.us/j/123456789?redirect=https://evil.test",
    "https://meet.google.com/abc-defg-hij#secret", "https://meet.google.com/abc-defg-hij#", "https://meet.google.com:443/abc-defg-hij",
    "https://user:password@meet.google.com/abc-defg-hij", "https://meet.google.com./abc-defg-hij", "https://meet.google.com/a/../abc-defg-hij",
    "https://meet.google.com/%2e%2e/abc-defg-hij", "https://meet.google.com/abc-defg-hij\n", "https://meet.google.com\\@evil.test/abc-defg-hij",
    "https://127.0.0.1/abc-defg-hij", "https://[::1]/abc-defg-hij", "https://meet.google.com/lookup/private", "https://teams.live.com/meet/123",
    "https://teams.microsoft.com/l/meetup-join/19%3ameeting_ABC%40thread.v2/0?context=%7B%22url%22%3A%22secret%22%7D"];
  for (const value of invalid) assert.throws(() => parseMeetingUrl(value), /^Error: invalid_meeting_url$/);
});
await proof("completed only after acknowledged chunk, cleanup and finalize; start/stop are idempotent", async () => {
  const f = fixture(); assert.equal(f.session.snapshot.status, "requested");
  const done = f.session.start(); assert.equal(done, f.session.start());
  const result = await done;
  assert.equal(result.status, "completed"); assert.equal(result.error_code, null);
  assert.deepEqual(f.events, ["join", "capture", "write", "cleanup", "force", "finalize"]);
  assert.deepEqual(f.finals, [{ expected_chunks: 1, is_complete: true }]);
  assert.equal(f.ownedResource, false); assert.equal(f.cleanupCount, 1); assert.equal(f.forceCount, 1);
  assert.deepEqual(await f.session.stop(), result); assert.deepEqual(await f.session.cancel(), result);
  assert(!JSON.stringify(result).includes("google.com")); assert(Object.isFrozen(result));
});
await proof("waiting admission, stop before admission and late callbacks cannot resurrect state", async () => {
  let late = () => {};
  const f = fixture({ async join({ waitingAdmission }) { late = waitingAdmission; waitingAdmission(); await hang(); } });
  const done = f.session.start(); await tick(); assert.equal(f.session.snapshot.status, "waiting_admission");
  assert.equal(await f.session.stop(), await done); const state = f.session.snapshot; late();
  assert.deepEqual(f.session.snapshot, state); assert.equal(state.status, "cancelled"); assert.equal(f.forceCount, 1); assert.equal(f.finals.length, 0);
});
await proof("stop drains capture and final chunk before complete", async () => {
  const f = fixture({ async capture({ emit, stop }) { await emit(chunk()); await aborted(stop); await emit(chunk(1)); } });
  const done = f.session.start(); await tick();
  const stopped = f.session.stop(); assert.equal(f.session.snapshot.status, "stopping"); assert.equal(stopped, f.session.stop());
  assert.equal((await done).status, "completed"); assert.deepEqual(f.finals, [{ expected_chunks: 2, is_complete: true }]);
});
await proof("cancel preserves acknowledged prefix as incomplete", async () => {
  const f = fixture({ async capture({ emit }) { await emit(chunk()); await hang(); } });
  f.session.start(); await tick(); const result = await f.session.cancel();
  assert.equal(result.status, "cancelled"); assert.deepEqual(f.finals, [{ expected_chunks: 1, is_complete: false }]); assert.equal(f.forceCount, 1);
});
await proof("cancel before start never joins but still cleans up", async () => {
  const f = fixture(); assert.equal((await f.session.cancel()).status, "cancelled"); assert.deepEqual(f.events, ["cleanup", "force"]);
});
for (const [name, overrides, code] of [
  ["join", { join: hang }, "join_timeout"],
  ["admission", { async join({ waitingAdmission }) { waitingAdmission(); await hang(); } }, "admission_timeout"],
  ["duration", { capture: hang }, "duration_limit"],
  ["cleanup timeout", { cleanup: hang }, "cleanup_timeout"],
  ["cleanup exception", { async cleanup() { throw new Error("sensitive secret"); } }, "cleanup_failed"],
  ["denied", { async join() { throw new CaptureError("admission_denied"); } }, "admission_denied"],
  ["adapter exception", { async capture() { throw new Error("private meeting URL and token"); } }, "adapter_failed"],
  ["no audio", { async capture() {} }, "media_unavailable"],
] satisfies [string, Partial<CaptureAdapter>, string][]) {
  await proof(`${name}: bounded failure always forces cleanup`, async () => {
    const f = fixture(overrides); const result = await f.session.start();
    assert.equal(result.status, "failed"); assert.equal(result.error_code, code); assert.equal(f.forceCount, 1); assert.equal(f.ownedResource, false);
    assert(!JSON.stringify(result).includes("secret")); assert(!f.finals.some(body => body.is_complete));
  });
}
await proof("uncooperative graceful stop fails within deadline and cleans up", async () => {
  const f = fixture({ capture: hang }); f.session.start(); await tick();
  assert.equal((await f.session.stop()).error_code, "stop_timeout"); assert.equal(f.forceCount, 1);
});
for (const bad of [ { ...chunk(), sequence: 1 }, { ...chunk(), start_ms: 1 }, { ...chunk(), end_ms: 0 },
  { ...chunk(), bytes: new Uint8Array(0) }, { ...chunk(), content_type: "text/plain" }, { ...chunk(), end_ms: 14_400_001 } ]) {
  await proof("invalid audio cannot complete or skip cleanup", async () => {
    const f = fixture({ async capture({ emit }) { await emit(bad); } });
    assert.equal((await f.session.start()).status, "failed"); assert.equal(f.forceCount, 1); assert.equal(f.finals.length, 0);
  });
}
await proof("upload timeout/failure never marks recording complete", async () => {
  for (const write of [hang, async () => { throw new Error("private storage path"); }]) {
    const f = fixture({}, { write }); assert.equal((await f.session.start()).error_code, "upload_failed"); assert.equal(f.forceCount, 1); assert.equal(f.finals.length, 0);
  }
});
await proof("stream discontinuity and MIME change retain only acknowledged prefix", async () => {
  for (const next of [{ ...chunk(1), start_ms: 11 }, { ...chunk(1), content_type: "audio/ogg" }, chunk(0)]) {
    const f = fixture({ async capture({ emit }) { await emit(chunk()); await emit(next); } });
    assert.equal((await f.session.start()).error_code, "invalid_chunk");
    assert.deepEqual(f.finals, [{ expected_chunks: 1, is_complete: false }]);
  }
});
await proof("late emission cannot write after timeout and terminal state is stable", async () => {
  let late: ((value: AudioChunk) => Promise<void>) | undefined;
  const f = fixture({ async capture({ emit }) { late = emit; await hang(); } });
  const result = await f.session.start();
  await assert.rejects(() => late!(chunk()));
  assert.deepEqual(f.session.snapshot, result); assert(!f.events.includes("write"));
});
await proof("concurrent emissions fail closed without an unbounded queue", async () => {
  const f = fixture({ async capture({ emit }) { await Promise.allSettled([emit(chunk()), emit(chunk())]); } }, { async write(_chunk, signal) { await aborted(signal); signal.throwIfAborted(); } });
  assert.equal((await f.session.start()).status, "failed"); assert.equal(f.forceCount, 1); assert.equal(f.finals.length, 0);
});
await proof("finalize rejection and timeout cannot report completed", async () => {
  for (const finalize of [hang, async () => { throw new Error("private server response"); }]) {
    const f = fixture({}, { finalize }); assert.equal((await f.session.start()).error_code, "finalize_failed"); assert.equal(f.forceCount, 1);
  }
});
console.log(`Synthetic proof passed: ${checks} scenarios. No real platform/audio integration was exercised.`);
