import { queryOptions } from "@tanstack/react-query";

import { apiErrorMessage, backendClient } from "#/shared/api";
import {
  createMeeting,
  createParticipant,
  createProcessingJob,
  createRecording,
  deleteRecording,
  getMeeting,
  listMeetings,
  listParticipants,
  listProcessingJobs,
  listRecordings,
  updateMeeting,
  uploadRecordingFile,
} from "#/shared/api";
import type {
  MeetingCreate,
  MeetingUpdate,
  ParticipantCreate,
  ProcessingJobCreate,
  ProcessingJobRead,
  RecordingRead,
} from "#/shared/api";

function required<T>(result: { data?: T; error?: unknown }): T {
  if (result.data === undefined || result.error)
    throw new Error(apiErrorMessage(result.error, "Request failed"));
  return result.data;
}

export const meetingsQuery = (offset = 0) =>
  queryOptions({
    queryKey: ["meetings", offset],
    enabled: typeof window !== "undefined",
    queryFn: async () =>
      required(
        await listMeetings({
          client: backendClient,
          query: { limit: 100, offset },
        })
      ),
  });

export const meetingQuery = (meetingId: string) =>
  queryOptions({
    queryKey: ["meeting", meetingId],
    enabled: typeof window !== "undefined",
    queryFn: async () =>
      required(
        await getMeeting({
          client: backendClient,
          path: { meeting_id: meetingId },
        })
      ),
  });

export const participantsQuery = (meetingId: string) =>
  queryOptions({
    queryKey: ["participants", meetingId],
    enabled: typeof window !== "undefined",
    queryFn: async () =>
      required(
        await listParticipants({
          client: backendClient,
          path: { meeting_id: meetingId },
          query: { limit: 100 },
        })
      ),
  });

export const recordingsQuery = (meetingId: string) =>
  queryOptions({
    queryKey: ["recordings", meetingId],
    enabled: typeof window !== "undefined",
    queryFn: async () =>
      required(
        await listRecordings({
          client: backendClient,
          path: { meeting_id: meetingId },
          query: { limit: 100 },
        })
      ),
  });

export const jobsQuery = (meetingId: string, recordingId: string) =>
  queryOptions({
    queryKey: ["jobs", meetingId, recordingId],
    enabled: typeof window !== "undefined" && !!recordingId,
    queryFn: async () =>
      required(
        await listProcessingJobs({
          client: backendClient,
          path: { meeting_id: meetingId, recording_id: recordingId },
          query: { limit: 100 },
        })
      ),
    refetchInterval: (query) =>
      query.state.data?.items.some(
        (job: ProcessingJobRead) =>
          job.status === "queued" || job.status === "running"
      )
        ? 3000
        : false,
  });

export const saveMeeting = async (body: MeetingCreate) =>
  required(await createMeeting({ client: backendClient, body }));

export const editMeeting = async (meetingId: string, body: MeetingUpdate) =>
  required(
    await updateMeeting({
      client: backendClient,
      path: { meeting_id: meetingId },
      body,
    })
  );

export const addParticipant = async (
  meetingId: string,
  body: ParticipantCreate
) =>
  required(
    await createParticipant({
      client: backendClient,
      path: { meeting_id: meetingId },
      body,
    })
  );

export async function uploadFile(
  meetingId: string,
  file: File,
  onProgress: (value: number) => void
): Promise<RecordingRead> {
  const recording = required(
    await createRecording({
      client: backendClient,
      path: { meeting_id: meetingId },
      body: {
        source: "file",
        original_filename: file.name,
        content_type: file.type || "application/octet-stream",
      },
    })
  );
  onProgress(10);
  try {
    const uploaded = required(
      await uploadRecordingFile({
        client: backendClient,
        path: { meeting_id: meetingId, recording_id: recording.id },
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      })
    );
    onProgress(100);
    return uploaded;
  } catch (error) {
    await deleteRecording({
      client: backendClient,
      path: { meeting_id: meetingId, recording_id: recording.id },
    }).catch(() => {});
    throw error;
  }
}

export type ProcessingTarget = NonNullable<ProcessingJobCreate["target_stage"]>;

export const startProcessing = async (
  meetingId: string,
  recordingId: string,
  retryOfJobId?: string,
  targetStage: ProcessingTarget = "transcribe"
) =>
  required(
    await createProcessingJob({
      client: backendClient,
      path: { meeting_id: meetingId, recording_id: recordingId },
      body: {
        request_key: crypto.randomUUID(),
        language: "auto",
        target_stage: targetStage,
        ...(retryOfJobId ? { retry_of_job_id: retryOfJobId } : {}),
      },
    })
  );
