import { strict as assert } from "node:assert";
import { CaptureSession, type AudioChunk, type AudioSink } from "../lifecycle.ts";
import { meetingUrl, ZoomAdapter } from "./adapter.ts";

const modulePath = process.env.PLAYWRIGHT_MODULE || "playwright";
const { chromium } = await import(modulePath);
const html = (mode: string) => `<!doctype html><html><body>
<input id="input-for-name" placeholder="Your name"><input type="password" placeholder="Passcode">
<button id="join">Join</button><div id="state"></div>
<script>
document.querySelector('#join').onclick = async () => {
  if (document.querySelector('input[type=password]').value !== 'fixturepass') {
    document.querySelector('#state').textContent = 'Invalid passcode'; return;
  }
  if (${JSON.stringify(mode)} === 'reject') { document.querySelector('#state').textContent = 'Host has removed you'; return; }
  if (${JSON.stringify(mode)} === 'waiting') {
    document.querySelector('#state').textContent = 'Waiting room: host will let you in';
    setTimeout(admit, 250);
  } else if (${JSON.stringify(mode)} === 'hold') {
    document.querySelector('#state').textContent = 'Waiting room: host will let you in';
  } else admit();
};
async function admit() {
  document.querySelector('#state').textContent = '';
  document.body.insertAdjacentHTML('beforeend', '<div id="wc-footer">In meeting</div>');
  const ctx = new AudioContext();
  await ctx.resume();
  const tone = ctx.createOscillator(); tone.frequency.value = 440;
  const destination = ctx.createMediaStreamDestination();
  tone.connect(destination);
  const silentOutput = ctx.createGain(); silentOutput.gain.value = 0;
  tone.connect(silentOutput); silentOutput.connect(ctx.destination);
  tone.start();
  const peer = new RTCPeerConnection();
  const trackEvent = new Event('track');
  Object.defineProperty(trackEvent, 'track', { value: destination.stream.getAudioTracks()[0] });
  peer.dispatchEvent(trackEvent);
  window.fixtureStop = () => { peer.close(); tone.stop(); ctx.close(); };
  if (${JSON.stringify(mode)} === 'end') setTimeout(() => {
    document.querySelector('#state').textContent = 'Meeting has ended';
  }, 1400);
}
</script></body></html>`;

let checks = 0;
async function scenario(mode: string, password = "fixturepass", admissionMs = 5000) {
  const chunks: AudioChunk[] = [];
  const finals: { expected_chunks: number; is_complete: boolean }[] = [];
  let browser: any;
  const adapter = new ZoomAdapter(async () => {
    browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
    const nativeContext = browser.newContext.bind(browser);
    browser.newContext = async (options: object) => {
      const context = await nativeContext(options);
      await context.route("https://zoom.us/j/**", (route: any) => route.fulfill({ contentType: "text/html", body: html(mode) }));
      return context;
    };
    return browser;
  }, password);
  const sink: AudioSink = {
    async write(chunk) { chunks.push(chunk); },
    async finalize(body) { finals.push(body); },
  };
  const session = new CaptureSession({
    id: "00000000-0000-4000-8000-000000000001", meeting_id: "00000000-0000-4000-8000-000000000002",
    recording_id: "00000000-0000-4000-8000-000000000003", meeting_url: meetingUrl("12345678901"),
    display_name: "Synthetic recorder", recording_notice_confirmed: true,
    timeouts: { join_ms: 5000, admission_ms: admissionMs, duration_ms: 5000, stop_ms: 3000, cleanup_ms: 3000, io_ms: 3000 },
  }, adapter, sink);
  const done = session.start();
  return { session, done, chunks, finals, get browser() { return browser; } };
}

assert.equal(meetingUrl("12345678901"), "https://zoom.us/j/12345678901");
for (const id of ["123", "123456789012", "1234567890x"]) assert.throws(() => meetingUrl(id), /invalid_meeting_url/);
checks++;

const recorded = await scenario("waiting");
for (let i = 0; i < 100 && recorded.session.snapshot.status !== "waiting_admission"; i++) await Bun.sleep(10);
assert.equal(recorded.session.snapshot.status, "waiting_admission");
for (let i = 0; i < 100 && recorded.session.snapshot.status !== "recording"; i++) await Bun.sleep(50);
assert.equal(recorded.session.snapshot.status, "recording");
await Bun.sleep(1700);
const completed = await recorded.session.stop();
assert.equal(completed.status, "completed");
assert(recorded.chunks.length > 0);
assert.deepEqual(recorded.finals, [{ expected_chunks: recorded.chunks.length, is_complete: true }]);
assert(recorded.chunks.every((chunk, index) => chunk.sequence === index && chunk.bytes.length > 0));
assert.equal(recorded.browser.isConnected(), false);
const media = Uint8Array.from(recorded.chunks.flatMap(chunk => Array.from(chunk.bytes)));
const decoder = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await decoder.newPage();
  const rms = await page.evaluate(async bytes => {
    const context = new AudioContext();
    const decoded = await context.decodeAudioData(Uint8Array.from(bytes).buffer);
    const samples = decoded.getChannelData(0);
    const power = samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length;
    await context.close();
    return Math.sqrt(power);
  }, Array.from(media));
  assert(rms > 0.01, `synthetic remote tone was silent: ${rms}`);
  console.log(`ok: audible synthetic track-event tone, ${recorded.chunks.length} chunks, RMS ${rms.toFixed(3)}`);
} finally { await decoder.close(); }
checks++;

const ended = await scenario("end");
assert.equal((await ended.done).status, "completed");
assert(ended.chunks.length > 0);
checks++;

const wrong = await scenario("normal", "wrongpass");
assert.equal((await wrong.done).error_code, "authentication_required");
assert.equal(wrong.chunks.length, 0);
checks++;

const rejected = await scenario("reject");
assert.equal((await rejected.done).error_code, "admission_denied");
assert.equal(rejected.chunks.length, 0);
assert.equal(rejected.browser.isConnected(), false);
checks++;

const waitingTimeout = await scenario("hold", "fixturepass", 400);
assert.equal((await waitingTimeout.done).error_code, "admission_timeout");
assert.equal(waitingTimeout.browser.isConnected(), false);
checks++;

console.log(`Zoom fixture checks passed: ${checks}. No live Zoom meeting was joined.`);
