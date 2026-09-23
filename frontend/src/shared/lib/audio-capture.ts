/** One capture owns one continuous MediaRecorder stream (meeting-contract.md, #21). */
export type CaptureSource = "microphone" | "display" | "both";
export type CaptureIssue =
  | "unsupported"
  | "permission"
  | "no_audio"
  | "source_lost"
  | "limit"
  | "device";
export type CaptureChunk = Readonly<{
  sequence: number;
  start_ms: number;
  end_ms: number;
  content_type: string;
  data: Blob;
}>;
export type CaptureResult = Readonly<{
  chunks: readonly CaptureChunk[];
  blob: Blob;
  is_complete: boolean;
}>;
export type CaptureState = {
  phase:
    | "idle"
    | "requesting"
    | "recording"
    | "stopping"
    | "complete"
    | "incomplete"
    | "error";
  elapsedMs: number;
  bytes: number;
  chunkCount: number;
  sources: {
    kind: "microphone" | "display";
    label: string;
    level: number;
    silent: boolean;
    muted: boolean;
  }[];
  issue?: CaptureIssue;
  result?: CaptureResult;
};
export const initialCaptureState: CaptureState = {
  phase: "idle",
  elapsedMs: 0,
  bytes: 0,
  chunkCount: 0,
  sources: [],
};
// hack: bounded local RAM only; wire durable capture and the generated transport with #9.
const MAX_BYTES = 64 * 1024 * 1024;
const MAX_CHUNK_BYTES = 8 * 1024 * 1024;
const MAX_DURATION_MS = 30 * 60 * 1000;
const MAX_CHUNKS = 4096;

export const captureSupported = (source: CaptureSource) =>
  typeof window !== "undefined" &&
  window.isSecureContext &&
  typeof MediaRecorder !== "undefined" &&
  typeof AudioContext !== "undefined" &&
  typeof navigator.mediaDevices?.getUserMedia === "function" &&
  (source === "microphone" ||
    typeof navigator.mediaDevices?.getDisplayMedia === "function");

export class AudioCapture {
  private readonly trackEvents = new AbortController();
  private readonly recorderEvents = new AbortController();
  private state: CaptureState = { ...initialCaptureState };
  private streams: MediaStream[] = [];
  private context?: AudioContext;
  private recorder?: MediaRecorder;
  private timer?: ReturnType<typeof setInterval>;
  private chunks: CaptureChunk[] = [];
  private startedAt = 0;
  private lastEndMs = 0;
  private disposed = false;
  private acceptChunks = true;
  private meters: {
    analyser: AnalyserNode;
    samples: Float32Array<ArrayBuffer>;
    track: MediaStreamTrack;
    lastSignal: number;
  }[] = [];

  constructor(private readonly onChange: (state: CaptureState) => void) {}

  private publish(patch: Partial<CaptureState>) {
    this.state = { ...this.state, ...patch };
    if (!this.disposed) this.onChange(this.state);
  }

  private own(stream: MediaStream) {
    if (this.disposed) {
      for (const track of stream.getTracks()) track.stop();
      throw new DOMException("Capture cancelled", "AbortError");
    }
    this.streams.push(stream);
    if (this.state.phase !== "requesting") throw new Error("source_lost");
    for (const track of stream.getTracks()) {
      track.addEventListener("ended", () => this.stop("source_lost"), {
        signal: this.trackEvents.signal,
      });
    }
    const audio = stream
      .getAudioTracks()
      .filter((track) => track.readyState === "live");
    if (audio.length === 0) throw new Error("no_audio");
    return audio;
  }

  private canStart() {
    return !this.disposed && this.state.phase === "requesting";
  }

  async start(source: CaptureSource) {
    if (this.state.phase !== "idle" || this.disposed) return;
    if (!captureSupported(source)) {
      this.publish({ phase: "error", issue: "unsupported" });
      return;
    }
    this.publish({ phase: "requesting" });
    try {
      const inputs: {
        kind: "microphone" | "display";
        track: MediaStreamTrack;
      }[] = [];
      // Must run in the start-button gesture, before any other permission await.
      if (source !== "microphone") {
        const options = {
          video: true,
          audio: true,
          systemAudio: "include",
          surfaceSwitching: "exclude",
        };
        const tracks = this.own(
          await navigator.mediaDevices.getDisplayMedia(options)
        );
        inputs.push(
          ...tracks.map((track) => ({ kind: "display" as const, track }))
        );
      }
      if (source !== "display") {
        const tracks = this.own(
          await navigator.mediaDevices.getUserMedia({ audio: true })
        );
        inputs.push(
          ...tracks.map((track) => ({ kind: "microphone" as const, track }))
        );
      }
      if (!this.canStart()) return;
      this.context = new AudioContext();
      await this.context.resume();
      if (!this.canStart()) return;
      const output = this.context.createMediaStreamDestination();
      this.streams.push(output.stream);
      this.meters = inputs.map(({ track }) => {
        const node = this.context!.createMediaStreamSource(
          new MediaStream([track])
        );
        const analyser = this.context!.createAnalyser();
        analyser.fftSize = 1024;
        node.connect(analyser);
        // Leave headroom when mixing microphone and shared audio; never monitor to speakers.
        const gain = this.context!.createGain();
        gain.gain.value = 1 / inputs.length;
        node.connect(gain).connect(output);
        return {
          analyser,
          samples: new Float32Array(1024),
          track,
          lastSignal: performance.now(),
        };
      });
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ].find((mime) => MediaRecorder.isTypeSupported(mime));
      if (!mimeType) throw new Error("unsupported");
      this.recorder = new MediaRecorder(output.stream, {
        mimeType,
        audioBitsPerSecond: 128_000,
      });
      const events = { signal: this.recorderEvents.signal };
      this.recorder.addEventListener(
        "dataavailable",
        ({ data }) => this.collect(data),
        events
      );
      this.recorder.addEventListener(
        "error",
        () => this.stop("device"),
        events
      );
      this.recorder.addEventListener("stop", () => this.finish(), events);
      this.startedAt = performance.now();
      this.recorder.start(2000);
      this.publish({
        phase: "recording",
        sources: inputs.map(({ kind, track }) => ({
          kind,
          label: track.label,
          level: 0,
          silent: false,
          muted: track.muted,
        })),
      });
      this.timer = setInterval(() => this.tick(), 200);
    } catch (error) {
      this.release();
      const message = error instanceof Error ? error.message : "";
      const issue =
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "permission"
          : message === "no_audio" ||
              message === "unsupported" ||
              message === "source_lost"
            ? message
            : "device";
      this.publish({ phase: "error", issue });
    }
  }

  private tick() {
    const now = performance.now();
    const elapsedMs = Math.round(now - this.startedAt);
    const sources = this.state.sources.map((source, index) => {
      const meter = this.meters[index];
      meter.analyser.getFloatTimeDomainData(meter.samples);
      const rms = Math.sqrt(
        meter.samples.reduce((sum, value) => sum + value * value, 0) /
          meter.samples.length
      );
      if (
        rms > 0.003 &&
        !meter.track.muted &&
        this.context?.state === "running"
      )
        meter.lastSignal = now;
      return {
        ...source,
        level: Math.min(1, rms * 4),
        muted: meter.track.muted,
        silent: now - meter.lastSignal > 3000,
      };
    });
    this.publish({ elapsedMs, sources });
    if (elapsedMs >= MAX_DURATION_MS) this.stop("limit");
    else if (this.context?.state !== "running") this.stop("device");
  }

  private collect(data: Blob) {
    if (this.disposed || !this.acceptChunks || data.size === 0) return;
    if (
      data.size > MAX_CHUNK_BYTES ||
      this.state.bytes + data.size > MAX_BYTES ||
      this.chunks.length >= MAX_CHUNKS
    ) {
      // Keep only the continuous prefix. Never append after a rejected fragment.
      this.acceptChunks = false;
      this.stop("limit");
      return;
    }
    const end_ms = Math.max(
      this.lastEndMs + 1,
      Math.round(performance.now() - this.startedAt)
    );
    this.chunks.push(
      Object.freeze({
        sequence: this.chunks.length,
        start_ms: this.lastEndMs,
        end_ms,
        content_type: this.recorder!.mimeType,
        data,
      })
    );
    this.lastEndMs = end_ms;
    this.publish({
      bytes: this.state.bytes + data.size,
      chunkCount: this.chunks.length,
    });
    if (
      this.state.bytes >= MAX_BYTES - MAX_CHUNK_BYTES ||
      this.chunks.length >= MAX_CHUNKS - 1
    )
      this.stop("limit");
  }

  stop(issue?: CaptureIssue) {
    if (!["requesting", "recording", "stopping"].includes(this.state.phase))
      return;
    this.publish({ phase: "stopping", issue: this.state.issue ?? issue });
    if (this.recorder) {
      if (this.recorder.state !== "inactive") this.recorder.stop();
      // onstop runs after the final dataavailable, including recorder errors.
    } else {
      this.release();
      this.publish({ phase: "error", issue: issue ?? "device" });
    }
  }

  private finish() {
    const unexpected = this.state.phase !== "stopping";
    this.release();
    const issue = this.state.issue ?? (unexpected ? "source_lost" : undefined);
    if (!this.chunks.length) {
      this.publish({ phase: "error", issue: issue ?? "no_audio" });
      return;
    }
    const chunks = Object.freeze([...this.chunks]);
    const blob = new Blob(
      chunks.map((chunk) => chunk.data),
      { type: chunks[0].content_type }
    );
    this.publish({
      phase: issue ? "incomplete" : "complete",
      issue,
      elapsedMs: this.lastEndMs,
      result: Object.freeze({ chunks, blob, is_complete: !issue }),
    });
  }

  private release() {
    clearInterval(this.timer);
    this.trackEvents.abort();
    for (const stream of this.streams) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
    }
    this.streams = [];
    if (this.context && this.context.state !== "closed")
      void this.context.close().catch(() => {});
    this.meters = [];
  }

  dispose() {
    this.disposed = true;
    this.recorderEvents.abort();
    if (this.recorder) {
      if (this.recorder.state !== "inactive") this.recorder.stop();
    }
    this.release();
    this.chunks = [];
    this.state = { ...initialCaptureState };
  }
}

/** Bind these callbacks to the generated #9 SDK and ONE persisted recording_id.
 * No HTTP endpoint is invented here. Throw {status} for HTTP failures.
 * A repeated call must reuse that ID and these exact immutable chunks.
 */
export async function uploadCapture(
  result: CaptureResult,
  transport: {
    putChunk: (chunk: CaptureChunk, signal: AbortSignal) => Promise<void>;
    finalize: (
      body: { expected_chunks: number; is_complete: boolean },
      signal: AbortSignal
    ) => Promise<void>;
  },
  signal: AbortSignal
) {
  const retry = async (operation: () => Promise<void>) => {
    for (let attempt = 0; ; attempt++) {
      signal.throwIfAborted();
      try {
        await operation();
        return;
      } catch (error) {
        signal.throwIfAborted();
        const status =
          typeof error === "object" && error !== null && "status" in error
            ? Number(error.status)
            : 0;
        if (
          attempt >= 2 ||
          (status !== 0 && status !== 408 && status !== 429 && status < 500)
        )
          throw error;
        await new Promise<void>((resolve, reject) => {
          const abort = () => {
            clearTimeout(timer);
            reject(signal.reason);
          };
          const timer = setTimeout(
            () => {
              signal.removeEventListener("abort", abort);
              resolve();
            },
            500 * 2 ** attempt
          );
          signal.addEventListener("abort", abort, { once: true });
        });
      }
    }
  };
  for (const chunk of result.chunks)
    await retry(() => transport.putChunk(chunk, signal));
  await retry(() =>
    transport.finalize(
      {
        expected_chunks: result.chunks.length,
        is_complete: result.is_complete,
      },
      signal
    )
  );
}
