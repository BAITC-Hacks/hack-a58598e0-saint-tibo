import { z } from "zod";

import type { TranscriptSegment } from "#/shared/ui/transcript-sync";

const MAX_TRANSCRIPT_BYTES = 8 * 1024 * 1024;
const MAX_AUDIO_HASH_BYTES = 256 * 1024 * 1024;
const transcriptSchema = z.object({
  audio_sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  segments: z
    .array(
      z.object({
        index: z.number().int(),
        start_ms: z.number().int().nonnegative(),
        end_ms: z.number().int().positive(),
        text: z.string().trim().min(1).max(10_000),
      })
    )
    .min(1)
    .max(10_000),
});

export type LocalTranscriptError = "invalid" | "mismatch" | "too_large";

function fail(reason: LocalTranscriptError): never {
  throw new Error(reason);
}

/** Import the private benchmark JSON only when it matches the selected audio bytes. */
export async function readLocalTranscript(
  transcriptFile: File,
  audioFile: File,
  recordingId: string
): Promise<TranscriptSegment[]> {
  if (
    transcriptFile.size > MAX_TRANSCRIPT_BYTES ||
    audioFile.size > MAX_AUDIO_HASH_BYTES
  )
    fail("too_large");

  let document: unknown;
  try {
    document = JSON.parse(await transcriptFile.text());
  } catch {
    fail("invalid");
  }
  const parsed = transcriptSchema.safeParse(document);
  if (!parsed.success) fail("invalid");
  const value = parsed.data;

  const segments = value.segments.map((segment, position) => {
    if (segment.end_ms <= segment.start_ms) fail("invalid");
    return {
      id: `local-${position}`,
      recording_id: recordingId,
      result_version_id: "local-stt",
      start_ms: segment.start_ms,
      end_ms: segment.end_ms,
      text: segment.text,
    };
  });
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", await audioFile.arrayBuffer())
  );
  const sha256 = Array.from(digest, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  if (sha256 !== value.audio_sha256.toLowerCase()) fail("mismatch");
  return segments;
}
