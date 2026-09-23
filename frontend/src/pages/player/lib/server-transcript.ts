import {
  backendClient,
  listResultVersions,
  listTranscriptSegments,
} from "#/shared/api";
import type { ResultVersionRead, SegmentRead } from "#/shared/api";

type RecordingPath = { meeting_id: string; recording_id: string };

export async function latestCompletedResult(
  path: RecordingPath,
  signal: AbortSignal
): Promise<ResultVersionRead | null> {
  let offset = 0;
  while (true) {
    const { data } = await listResultVersions({
      client: backendClient,
      path,
      query: { limit: 100, offset },
      signal,
      throwOnError: true,
    });
    const completed = data.items.find(
      (version) => version.completed_stage === "transcribe"
    );
    if (completed) return completed;
    offset += data.items.length;
    if (offset >= data.total || data.items.length === 0) return null;
  }
}

export async function allTranscriptSegments(
  path: RecordingPath & { result_version_id: string },
  signal: AbortSignal
): Promise<SegmentRead[]> {
  const segments: SegmentRead[] = [];
  while (true) {
    const { data } = await listTranscriptSegments({
      client: backendClient,
      path,
      query: { limit: 100, offset: segments.length },
      signal,
      throwOnError: true,
    });
    segments.push(...data.items);
    if (segments.length >= data.total) return segments;
    if (data.items.length === 0) throw new Error("Incomplete transcript page");
  }
}
