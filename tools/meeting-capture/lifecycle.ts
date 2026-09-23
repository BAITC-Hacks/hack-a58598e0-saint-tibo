import { parseMeetingUrl, type MeetingTarget, type Platform } from "./url.ts";

export type Status = "requested" | "joining" | "waiting_admission" | "recording" | "stopping" | "completed" | "failed" | "cancelled";
export type ErrorCode = "cancelled" | "join_timeout" | "admission_timeout" | "duration_limit" | "stop_timeout"
  | "cleanup_failed" | "cleanup_timeout" | "adapter_failed" | "admission_denied" | "authentication_required"
  | "permission_revoked" | "media_unavailable" | "invalid_chunk" | "recording_limit" | "upload_failed" | "finalize_failed";
const codes: readonly string[] = ["cancelled", "join_timeout", "admission_timeout", "duration_limit", "stop_timeout",
  "cleanup_failed", "cleanup_timeout", "adapter_failed", "admission_denied", "authentication_required",
  "permission_revoked", "media_unavailable", "invalid_chunk", "recording_limit", "upload_failed", "finalize_failed"];
export class CaptureError extends Error {
  constructor(readonly code: ErrorCode) { super(code); }
}
const safeCode = (error: unknown): ErrorCode => error instanceof CaptureError && codes.includes(error.code) ? error.code : "adapter_failed";

/** One continuous encoded stream, NOT one standalone WAV/container per callback. */
export type AudioChunk = Readonly<{ sequence: number; start_ms: number; end_ms: number; content_type: string; bytes: Uint8Array }>;
export interface AudioSink {
  // Bound by the integration to an authorized meeting/recording pair; never derive owner from adapter input.
  write(chunk: AudioChunk, signal: AbortSignal): Promise<void>;
  finalize(body: { expected_chunks: number; is_complete: boolean }, signal: AbortSignal): Promise<void>;
}
export interface CaptureAdapter {
  readonly platform: Platform;
  readonly capabilities: Readonly<{ joins_as_participant: boolean; provides_mixed_audio: boolean; provides_participant_audio: boolean }>;
  join(context: { target: MeetingTarget; display_name: string; signal: AbortSignal; waitingAdmission(): void }): Promise<void>;
  // Resolve only after capture ends AND every write is acknowledged. stop asks for drain; signal aborts now.
  capture(context: { signal: AbortSignal; stop: AbortSignal; emit(chunk: AudioChunk): Promise<void> }): Promise<void>;
  // Must work after partial join and with a fresh signal, independent of the aborted capture signal.
  cleanup(signal: AbortSignal): Promise<void>;
  // Synchronous, idempotent local teardown, including owned process group/audio sink/handles.
  // Called even if cleanup times out. SDK/network leave is still cleanup's responsibility.
  forceCleanup(): void;
}
export type Snapshot = Readonly<{
  id: string; meeting_id: string; recording_id: string; platform: Platform; status: Status;
  error_code: ErrorCode | null; started_at: string | null; ended_at: string | null;
}>;
type Timeouts = { join_ms: number; admission_ms: number; duration_ms: number; stop_ms: number; io_ms: number; cleanup_ms: number };
const defaults: Timeouts = { join_ms: 60_000, admission_ms: 120_000, duration_ms: 14_400_000, stop_ms: 10_000, io_ms: 30_000, cleanup_ms: 10_000 };
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** One in-memory attempt. No daemon, network endpoint, persistent state or registered platform adapter. */
export class CaptureSession {
  readonly #adapter: CaptureAdapter;
  readonly #sink: AudioSink;
  readonly #target: MeetingTarget;
  readonly #name: string;
  readonly #timeouts: Timeouts;
  readonly #abort = new AbortController();
  readonly #stop = new AbortController();
  #state: Snapshot;
  #done?: Promise<Snapshot>;
  #phaseTimer?: ReturnType<typeof setTimeout>;
  #stopTimer?: ReturnType<typeof setTimeout>;
  #sequence = 0;
  #end = 0;
  #bytes = 0;
  #mime?: string;
  #pending?: Promise<void>;
  #accepting = false;
  #uploadError?: CaptureError;

  constructor(input: { id: string; meeting_id: string; recording_id: string; meeting_url: string; display_name: string;
      recording_notice_confirmed: boolean; timeouts?: Partial<Timeouts> }, adapter: CaptureAdapter, sink: AudioSink) {
    this.#target = parseMeetingUrl(input.meeting_url);
    if (![input.id, input.meeting_id, input.recording_id].every(value => uuid.test(value))
        || !input.display_name.trim() || input.display_name.length > 120 || /[\x00-\x1f\x7f]/.test(input.display_name)
        || input.recording_notice_confirmed !== true || adapter.platform !== this.#target.platform) throw new Error("invalid_capture_request");
    this.#timeouts = { ...defaults, ...input.timeouts };
    if (Object.values(this.#timeouts).some(value => !Number.isSafeInteger(value) || value <= 0 || value > 14_400_000)) throw new Error("invalid_capture_timeout");
    this.#adapter = adapter;
    this.#sink = sink;
    this.#name = input.display_name.trim();
    this.#state = { id: input.id, meeting_id: input.meeting_id, recording_id: input.recording_id,
      platform: this.#target.platform, status: "requested", error_code: null, started_at: null, ended_at: null };
  }
  get snapshot(): Snapshot { return Object.freeze({ ...this.#state }); }
  start(): Promise<Snapshot> { return this.#done ??= this.#run(); }
  stop(): Promise<Snapshot> {
    if (this.#state.ended_at) return this.start();
    if (!this.#stop.signal.aborted) {
      this.#stop.abort();
      if (this.#state.status === "recording") {
        this.#state = { ...this.#state, status: "stopping" };
        this.#stopTimer = setTimeout(() => this.#abort.abort(new CaptureError("stop_timeout")), this.#timeouts.stop_ms);
      } else if (this.#state.status !== "stopping") this.#abort.abort(new CaptureError("cancelled"));
    }
    return this.start();
  }
  cancel(): Promise<Snapshot> {
    // Once capture has drained, cleanup/finalize is committed and cannot be cancelled.
    if (!this.#state.ended_at && (this.#state.status !== "stopping" || this.#accepting)) this.#abort.abort(new CaptureError("cancelled"));
    return this.start();
  }
  #deadline(ms: number, code: ErrorCode) {
    clearTimeout(this.#phaseTimer);
    this.#phaseTimer = setTimeout(() => this.#abort.abort(new CaptureError(code)), ms);
  }
  async #bounded<T>(operation: (signal: AbortSignal) => Promise<T>, ms: number, code: ErrorCode, parent?: AbortSignal): Promise<T> {
    const timeout = new AbortController();
    const signal = parent ? AbortSignal.any([parent, timeout.signal]) : timeout.signal;
    const timer = setTimeout(() => timeout.abort(new CaptureError(code)), ms);
    let rejectAbort: () => void = () => {};
    try {
      signal.throwIfAborted();
      return await Promise.race([new Promise<never>((_, reject) => {
        rejectAbort = () => reject(signal.reason);
        signal.addEventListener("abort", rejectAbort, { once: true });
      }), Promise.resolve().then(() => { signal.throwIfAborted(); return operation(signal); })]);
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", rejectAbort);
    }
  }
  async #emit(chunk: AudioChunk): Promise<void> {
    try {
      this.#abort.signal.throwIfAborted();
      if (!this.#accepting || this.#pending || this.#uploadError || !(chunk.bytes instanceof Uint8Array)
          || chunk.bytes.byteLength === 0 || chunk.bytes.byteLength > 8 * 1024 * 1024
          || chunk.sequence !== this.#sequence || !Number.isSafeInteger(chunk.start_ms) || !Number.isSafeInteger(chunk.end_ms)
          || chunk.start_ms !== this.#end || chunk.end_ms <= chunk.start_ms
          || !/^(audio\/(webm|ogg|wav|mpeg|flac|mp4)|video\/(webm|mp4))(;codecs=[a-zA-Z0-9., -]+)?$/.test(chunk.content_type)
          || (this.#mime !== undefined && chunk.content_type !== this.#mime)) throw new CaptureError("invalid_chunk");
      if (this.#sequence >= 4096 || this.#bytes + chunk.bytes.byteLength > 512 * 1024 * 1024 || chunk.end_ms > 14_400_000) throw new CaptureError("recording_limit");
      const stable = { ...chunk, bytes: chunk.bytes.slice() };
      this.#pending = this.#bounded(signal => this.#sink.write(stable, signal), this.#timeouts.io_ms, "upload_failed", this.#abort.signal);
      try { await this.#pending; } catch { throw new CaptureError("upload_failed"); } finally { this.#pending = undefined; }
      this.#abort.signal.throwIfAborted();
      this.#sequence++;
      this.#end = stable.end_ms;
      this.#bytes += stable.bytes.byteLength;
      this.#mime = stable.content_type;
    } catch (error) {
      this.#uploadError ??= new CaptureError(safeCode(error));
      this.#abort.abort(this.#uploadError);
      throw this.#uploadError;
    }
  }
  async #run(): Promise<Snapshot> {
    let error: ErrorCode | null = null;
    this.#state = { ...this.#state, started_at: new Date().toISOString() };
    try {
      this.#abort.signal.throwIfAborted();
      this.#state = { ...this.#state, status: "joining" };
      this.#deadline(this.#timeouts.join_ms, "join_timeout");
      await this.#bounded(signal => this.#adapter.join({ target: this.#target, display_name: this.#name, signal,
        waitingAdmission: () => {
          if (this.#abort.signal.aborted || this.#state.status !== "joining") return;
          this.#state = { ...this.#state, status: "waiting_admission" };
          this.#deadline(this.#timeouts.admission_ms, "admission_timeout");
        } }), this.#timeouts.join_ms + this.#timeouts.admission_ms, "join_timeout", this.#abort.signal);
      this.#abort.signal.throwIfAborted();
      this.#state = { ...this.#state, status: "recording" };
      this.#deadline(this.#timeouts.duration_ms, "duration_limit");
      this.#accepting = true;
      await this.#bounded(signal => this.#adapter.capture({ signal, stop: this.#stop.signal, emit: chunk => this.#emit(chunk) }),
        this.#timeouts.duration_ms, "duration_limit", this.#abort.signal);
      if (this.#pending) await this.#pending;
      if (this.#uploadError) throw this.#uploadError;
      this.#abort.signal.throwIfAborted();
      if (!this.#sequence) throw new CaptureError("media_unavailable");
    } catch (cause) { error = safeCode(cause); }
    finally {
      this.#accepting = false;
      clearTimeout(this.#phaseTimer);
      clearTimeout(this.#stopTimer);
      this.#state = { ...this.#state, status: "stopping" };
      this.#abort.abort(new CaptureError(error ?? "cancelled"));
      try { await this.#bounded(signal => this.#adapter.cleanup(signal), this.#timeouts.cleanup_ms, "cleanup_timeout"); }
      catch (cause) { error = cause instanceof CaptureError && cause.code === "cleanup_timeout" ? "cleanup_timeout" : "cleanup_failed"; }
      finally { try { this.#adapter.forceCleanup(); } catch { error = "cleanup_failed"; } }
    }
    // No audio -> no ready recording. An uncertain upload/finalize is never reported as completed.
    if (this.#sequence) {
      try { await this.#bounded(signal => this.#sink.finalize({ expected_chunks: this.#sequence, is_complete: error === null }, signal), this.#timeouts.io_ms, "finalize_failed"); }
      catch { error = "finalize_failed"; }
    }
    this.#state = { ...this.#state, status: error === null ? "completed" : error === "cancelled" ? "cancelled" : "failed",
      error_code: error, ended_at: new Date().toISOString() };
    return this.snapshot;
  }
}
