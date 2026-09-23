import { uploadCapture } from "#/shared/lib/audio-capture";
import type { CaptureResult } from "#/shared/lib/audio-capture";

import { backendClient } from "./backend-client";
import { apiErrorMessage } from "./errors";
import {
  createMeeting,
  createRecording,
  finalizeRecording,
  uploadRecordingChunk,
} from "./generated";
import type { RecordingRead } from "./generated";

export type CaptureTarget = { meetingId: string; recordingId: string };

function expectData<T>(result: {
  data?: T;
  error?: unknown;
  response?: Response;
}): T {
  if (result.error || !result.data) {
    const error = new Error(
      apiErrorMessage(result.error, "Recording request failed")
    );
    Object.assign(error, { status: result.response?.status ?? 0 });
    throw error;
  }
  return result.data;
}

export async function createCaptureTarget(
  result: CaptureResult,
  title: string,
  signal: AbortSignal
): Promise<CaptureTarget> {
  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Almaty";
  const meeting = expectData(
    await createMeeting({
      client: backendClient,
      body: { title, started_at: new Date().toISOString(), timezone },
      signal,
    })
  );
  const contentType = result.chunks[0]?.content_type || result.blob.type;
  const extension = contentType.includes("mp4")
    ? "m4a"
    : contentType.includes("ogg")
      ? "ogg"
      : "webm";
  const recording = expectData(
    await createRecording({
      client: backendClient,
      path: { meeting_id: meeting.id },
      body: {
        source: "live",
        original_filename: `recording.${extension}`,
        content_type: contentType,
      },
      signal,
    })
  );
  return { meetingId: meeting.id, recordingId: recording.id };
}

export async function saveCapture(
  result: CaptureResult,
  target: CaptureTarget,
  signal: AbortSignal
): Promise<RecordingRead> {
  let saved: RecordingRead | undefined;
  await uploadCapture(
    result,
    {
      putChunk: async (chunk, requestSignal) => {
        expectData(
          await uploadRecordingChunk({
            client: backendClient,
            path: {
              meeting_id: target.meetingId,
              recording_id: target.recordingId,
              sequence: chunk.sequence,
            },
            query: { start_ms: chunk.start_ms, end_ms: chunk.end_ms },
            headers: { "content-type": chunk.content_type },
            body: chunk.data,
            signal: requestSignal,
          })
        );
      },
      finalize: async (body, requestSignal) => {
        saved = expectData(
          await finalizeRecording({
            client: backendClient,
            path: {
              meeting_id: target.meetingId,
              recording_id: target.recordingId,
            },
            body,
            signal: requestSignal,
          })
        );
      },
    },
    signal
  );
  if (!saved) throw new Error("Recording response missing after finalize");
  return saved;
}
