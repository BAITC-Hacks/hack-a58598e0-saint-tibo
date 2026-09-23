import { Buffer } from "node:buffer";
import { CaptureError, type AudioChunk } from "../lifecycle.ts";
import { OwnedProcess } from "./process.ts";

export const opusOutputArgs = ["-map", "0:a:0", "-vn", "-ac", "1", "-ar", "48000", "-c:a", "libopus",
  "-b:a", "64k", "-application", "voip", "-f", "ogg", "-page_duration", "1000000", "-flush_packets", "1", "pipe:1"];

/** Parse page boundaries and Opus granules, not OS read sizes or wall-clock timestamps. */
export async function emitOgg(stream: AsyncIterable<Uint8Array>, emit: (chunk: AudioChunk) => Promise<void>, signal: AbortSignal) {
  let buffer = Buffer.alloc(0), pages: Buffer[] = [], held: Buffer[] = [];
  let serial: number | undefined, pageSequence = 0, preSkip = 0, end = 0, start = 0, heldEnd = 0, sequence = 0, size = 0;
  let eos = false;
  const fail = () => new CaptureError("media_unavailable");
  const flush = async () => {
    if (heldEnd <= start) throw fail();
    signal.throwIfAborted();
    await emit({ sequence: sequence++, start_ms: start, end_ms: heldEnd,
      content_type: "audio/ogg;codecs=opus", bytes: Buffer.concat(held) });
    start = heldEnd;
    held = [];
  };
  for await (const bytes of stream) {
    signal.throwIfAborted();
    buffer = Buffer.concat([buffer, bytes]);
    while (buffer.length >= 27) {
      if (eos || buffer.toString("ascii", 0, 4) !== "OggS" || buffer[4] !== 0) throw fail();
      const segments = buffer[26]!;
      if (buffer.length < 27 + segments) break;
      const length = 27 + segments + buffer.subarray(27, 27 + segments).reduce((sum, n) => sum + n, 0);
      if (buffer.length < length) break;
      const page = Buffer.from(buffer.subarray(0, length));
      buffer = buffer.subarray(length);
      const currentSerial = page.readUInt32LE(14), currentSequence = page.readUInt32LE(18);
      if (serial === undefined) {
        const head = page.subarray(27 + segments);
        if (!(page[5]! & 2) || head.toString("ascii", 0, 8) !== "OpusHead" || head.length < 19 || head[9] !== 1) throw fail();
        serial = currentSerial;
        preSkip = head.readUInt16LE(10);
      } else if (page[5]! & 2) throw fail(); // A restarted encoder requires a new recording_id.
      if (serial !== currentSerial || currentSequence !== pageSequence++) throw fail();
      const granule = page.readBigUInt64LE(6);
      if (granule !== 0xffffffffffffffffn && granule > BigInt(preSkip)) {
        if (granule > BigInt(48_000 * 14_400 + preSkip)) throw fail();
        const next = Math.ceil((Number(granule) - preSkip) / 48);
        if (next < end) throw fail();
        end = next;
      }
      pages.push(page);
      size += page.length;
      if (size > 8 * 1024 * 1024) throw fail();
      eos = Boolean(page[5]! & 4);
      if (end - heldEnd >= 4_000 && !eos) {
        if (held.length) await flush();
        held = pages;
        pages = [];
        heldEnd = end;
        size = held.reduce((sum, p) => sum + p.length, 0);
      }
    }
    if (buffer.length > 65_307) throw fail();
  }
  // A truncated encoder stream never becomes a completed recording.
  if (buffer.length || !eos || end <= 0) throw fail();
  held.push(...pages);
  heldEnd = end;
  await flush();
}

export async function captureProcess(process: OwnedProcess, context: {
  signal: AbortSignal; stop: AbortSignal; emit(chunk: AudioChunk): Promise<void>;
}) {
  const abort = () => process.kill();
  const stop = () => { process.child.stdin?.write("q\n"); }; // FFmpeg's normal quit command drains buffered audio and EOS.
  context.signal.addEventListener("abort", abort, { once: true });
  context.stop.addEventListener("abort", stop, { once: true });
  try {
    context.signal.throwIfAborted();
    if (context.stop.aborted) stop();
    if (!process.child.stdout) throw new CaptureError("media_unavailable");
    await emitOgg(process.child.stdout, context.emit, context.signal);
    const result = await process.done;
    context.signal.throwIfAborted();
    if (result.failed || !(result.code === 0 || (context.stop.aborted && result.code === 255))) throw new CaptureError("media_unavailable");
  } finally {
    context.signal.removeEventListener("abort", abort);
    context.stop.removeEventListener("abort", stop);
    process.kill();
  }
}
