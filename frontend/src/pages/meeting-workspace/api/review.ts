import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import { apiErrorMessage, backendClient } from "#/shared/api";
import {
  listRecordings,
  listResultVersions,
  listTranscriptSegments,
} from "#/shared/api";
import type { ResultVersionRead, SegmentRead } from "#/shared/api";
import { jsonBodySerializer } from "#/shared/api/generated/client";

const segment = z.object({
  id: z.string(),
  recording_id: z.string(),
  result_version_id: z.string(),
  speaker_id: z.string().nullable(),
  start_ms: z.number().int().nonnegative(),
  end_ms: z.number().int().positive(),
  text: z.string(),
});
const speaker = z.object({
  id: z.string(),
  result_version_id: z.string(),
  label: z.string(),
  participant_id: z.string().nullable(),
});
const action = z.object({
  id: z.string(),
  result_version_id: z.string(),
  text: z.string(),
  assignee_participant_id: z.string().nullable(),
  assignee_text: z.string().nullable(),
  due_text: z.string().nullable(),
  due_date: z.string().nullable(),
  status: z.enum(["open", "in_progress", "done", "cancelled"]),
  source_segment_ids: z.array(z.string()),
});
const summaryEntry = z.object({
  text: z.string(),
  source_segment_ids: z.array(z.string()),
});
export const reviewSchema = z.object({
  source: z.enum(["mock", "real"]),
  result_version_id: z.string(),
  revision: z.number().int().nonnegative(),
  reviewed: z.boolean(),
  summary: z.object({
    topics: z.array(summaryEntry),
    decisions: z.array(summaryEntry),
    open_questions: z.array(summaryEntry),
  }),
  segments: z.array(segment),
  speakers: z.array(speaker),
  action_items: z.array(action),
});

export type ReviewDocument = z.infer<typeof reviewSchema>;

async function realTranscript(
  meetingId: string
): Promise<ReviewDocument | null> {
  const recordings = await listRecordings({
    client: backendClient,
    path: { meeting_id: meetingId },
    query: { limit: 100 },
  });
  if (!recordings.data)
    throw new Error(
      apiErrorMessage(recordings.error, "Could not load recordings")
    );
  const versions: ResultVersionRead[] = [];
  for (const recording of recordings.data.items) {
    const result = await listResultVersions({
      client: backendClient,
      path: { meeting_id: meetingId, recording_id: recording.id },
      query: { limit: 100 },
    });
    if (!result.data)
      throw new Error(apiErrorMessage(result.error, "Could not load results"));
    versions.push(...result.data.items);
  }
  const latest = versions.toSorted((a, b) =>
    b.created_at.localeCompare(a.created_at)
  )[0];
  if (!latest) return null;
  const segments: SegmentRead[] = [];
  for (let offset = 0; ; offset += 100) {
    const result = await listTranscriptSegments({
      client: backendClient,
      path: {
        meeting_id: meetingId,
        recording_id: latest.recording_id,
        result_version_id: latest.id,
      },
      query: { limit: 100, offset },
    });
    if (!result.data)
      throw new Error(
        apiErrorMessage(result.error, "Could not load transcript")
      );
    segments.push(...result.data.items);
    if (offset + result.data.items.length >= result.data.total) break;
  }
  return {
    source: "real",
    result_version_id: latest.id,
    revision: latest.revision,
    reviewed: latest.status === "reviewed",
    segments,
    speakers: [],
    action_items: [],
    summary: { topics: [], decisions: [], open_questions: [] },
  };
}

/** Only the dev mock has draft review operations; real transcript reads use the generated SDK. */
export async function loadReview(
  meetingId: string
): Promise<ReviewDocument | null> {
  if (!(import.meta.env.DEV && import.meta.env.VITE_API_MODE === "mock"))
    return realTranscript(meetingId);
  const result = await backendClient.get({
    url: `/api/v1/meetings/${encodeURIComponent(meetingId)}/review`,
    security: [{ scheme: "bearer", type: "http" }],
  });
  if (result.response?.status === 404) return null;
  if (result.error || result.data === undefined)
    throw new Error(apiErrorMessage(result.error, "Could not load review"));
  return reviewSchema.parse(result.data);
}

export const reviewQuery = (meetingId: string) =>
  queryOptions({
    queryKey: ["review", meetingId],
    enabled: typeof window !== "undefined",
    queryFn: () => loadReview(meetingId),
  });

export async function saveReview(meetingId: string, review: ReviewDocument) {
  const result = await backendClient.patch({
    ...jsonBodySerializer,
    url: `/api/v1/meetings/${encodeURIComponent(meetingId)}/review`,
    security: [{ scheme: "bearer", type: "http" }],
    headers: { "Content-Type": "application/json" },
    body: {
      revision: review.revision,
      summary: review.summary,
      speakers: review.speakers,
      action_items: review.action_items,
      reviewed: review.reviewed,
    },
  });
  if (result.error || result.data === undefined)
    throw new Error(apiErrorMessage(result.error, "Could not save review"));
  return reviewSchema.parse(result.data);
}

export async function downloadReview(
  meetingId: string,
  format: "pdf" | "docx"
) {
  const result = await backendClient.get<Blob>({
    url: `/api/v1/meetings/${encodeURIComponent(meetingId)}/export`,
    query: { format },
    parseAs: "blob",
    security: [{ scheme: "bearer", type: "http" }],
  });
  if (result.error || !result.data)
    throw new Error(apiErrorMessage(result.error, "Export unavailable"));
  const url = URL.createObjectURL(result.data);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `meeting.${format}`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
