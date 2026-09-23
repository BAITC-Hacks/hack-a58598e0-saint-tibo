import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import {
  apiErrorMessage,
  backendClient,
  jsonBodySerializer,
} from "#/shared/api";
import {
  getResultDiarization,
  getResultReview,
  listRecordings,
  listResultVersions,
  listTranscriptSegments,
  updateResultReview,
} from "#/shared/api";
import type {
  DiarizationRead,
  ResultVersionRead,
  ReviewRead,
  SegmentRead,
} from "#/shared/api";

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
  merged_into_speaker_id: z.string().nullable().default(null),
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
  recording_id: z.string().optional(),
  result_version_id: z.string(),
  revision: z.number().int().nonnegative(),
  reviewed: z.boolean(),
  summary: z.object({
    topics: z.array(summaryEntry),
    decisions: z.array(summaryEntry),
    open_questions: z.array(summaryEntry),
  }),
  summary_source_segment_ids: z.array(z.string()).optional(),
  segments: z.array(segment),
  speakers: z.array(speaker),
  action_items: z.array(action),
});

export type ReviewDocument = z.infer<typeof reviewSchema> & {
  diarization?: DiarizationRead;
};

export class ReviewConflictError extends Error {}

const summaryEntries = (items: string[]) =>
  items.map((text) => ({ text, source_segment_ids: [] as string[] }));

function realDocument(
  data: ReviewRead,
  segments: SegmentRead[],
  diarization?: DiarizationRead
): ReviewDocument {
  return {
    source: "real",
    recording_id: data.recording_id,
    result_version_id: data.result_version_id,
    revision: data.revision,
    reviewed: data.reviewed,
    segments,
    diarization,
    speakers: (data.speakers ?? []).map((item) => ({
      id: item.speaker_id,
      result_version_id: data.result_version_id,
      label: item.label,
      participant_id: item.participant_id ?? null,
      merged_into_speaker_id: item.merged_into_speaker_id ?? null,
    })),
    action_items: data.action_items.map((item) => ({
      id: item.id ?? crypto.randomUUID(),
      result_version_id: item.result_version_id,
      text: item.text,
      assignee_participant_id: item.assignee_participant_id ?? null,
      assignee_text: item.assignee_text ?? null,
      due_text: item.due_text ?? null,
      due_date: item.due_date ?? null,
      status: item.status ?? "open",
      source_segment_ids: item.source_segment_ids ?? [],
    })),
    summary: {
      topics: summaryEntries(data.summary.topics ?? []),
      decisions: summaryEntries(data.summary.decisions ?? []),
      open_questions: summaryEntries(data.summary.open_questions ?? []),
    },
    summary_source_segment_ids: data.summary.source_segment_ids ?? [],
  };
}

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
  const review = await getResultReview({
    client: backendClient,
    path: {
      meeting_id: meetingId,
      recording_id: latest.recording_id,
      result_version_id: latest.id,
    },
  });
  if (!review.data)
    throw new Error(apiErrorMessage(review.error, "Could not load review"));
  let diarization: DiarizationRead | undefined;
  if (latest.completed_stage === "diarize" || latest.completed_stage === "extract") {
    const result = await getResultDiarization({
      client: backendClient,
      path: {
        meeting_id: meetingId,
        recording_id: latest.recording_id,
        result_version_id: latest.id,
      },
    });
    if (!result.data)
      throw new Error(apiErrorMessage(result.error, "Could not load speakers"));
    diarization = result.data;
  }
  return realDocument(review.data, segments, diarization);
}

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
    // A background refresh would remount the revision-keyed editor and erase its draft.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: () => loadReview(meetingId),
  });

export async function saveReview(meetingId: string, review: ReviewDocument) {
  if (review.source === "real") {
    if (!review.recording_id) throw new Error("Recording unavailable");
    const result = await updateResultReview({
      client: backendClient,
      path: {
        meeting_id: meetingId,
        recording_id: review.recording_id,
        result_version_id: review.result_version_id,
      },
      body: {
        revision: review.revision,
        reviewed: review.reviewed,
        speakers: review.speakers.map((item) => ({
          speaker_id: item.id,
          participant_id: item.participant_id,
          merged_into_speaker_id: item.merged_into_speaker_id,
        })),
        summary: {
          topics: review.summary.topics.map((entry) => entry.text),
          decisions: review.summary.decisions.map((entry) => entry.text),
          open_questions: review.summary.open_questions.map(
            (entry) => entry.text
          ),
          source_segment_ids: review.summary_source_segment_ids ?? [],
        },
        action_items: review.action_items.map((item) => ({
          id: item.id,
          text: item.text,
          assignee_participant_id: item.assignee_participant_id,
          assignee_text: item.assignee_text,
          due_text: item.due_text,
          due_date: item.due_date,
          status: item.status,
          source_segment_ids: item.source_segment_ids,
        })),
      },
    });
    if (result.response?.status === 409)
      throw new ReviewConflictError("Review revision changed");
    if (!result.data)
      throw new Error(apiErrorMessage(result.error, "Could not save review"));
    return realDocument(result.data, review.segments, review.diarization);
  }
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
  if (result.response?.status === 409)
    throw new ReviewConflictError("Review revision changed");
  if (result.error || result.data === undefined)
    throw new Error(apiErrorMessage(result.error, "Could not save review"));
  return reviewSchema.parse(result.data);
}

export async function reloadReview(meetingId: string, review: ReviewDocument) {
  if (review.source === "mock") {
    const loaded = await loadReview(meetingId);
    if (!loaded) throw new Error("Review unavailable");
    return loaded;
  }
  if (!review.recording_id) throw new Error("Recording unavailable");
  const result = await getResultReview({
    client: backendClient,
    path: {
      meeting_id: meetingId,
      recording_id: review.recording_id,
      result_version_id: review.result_version_id,
    },
  });
  if (!result.data)
    throw new Error(apiErrorMessage(result.error, "Could not load review"));
  return realDocument(result.data, review.segments, review.diarization);
}

export async function downloadReview(
  meetingId: string,
  format: "pdf" | "docx",
  review: ReviewDocument
) {
  const result = await backendClient.get<Blob>({
    url:
      review.source === "mock"
        ? `/api/v1/meetings/${encodeURIComponent(meetingId)}/export`
        : `/api/v1/meetings/${encodeURIComponent(meetingId)}/recordings/${encodeURIComponent(review.recording_id ?? "")}/results/${encodeURIComponent(review.result_version_id)}/export`,
    query:
      review.source === "mock"
        ? { format }
        : { format, revision: review.revision },
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
