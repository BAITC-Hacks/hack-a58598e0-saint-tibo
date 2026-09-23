import {
  apiErrorCode,
  backendClient,
  createRecording,
  uploadRecordingFile,
} from "#/shared/api";
import { m } from "#/shared/lib/i18n/messages";
import { useLocale } from "#/shared/lib/locales";

type CopyKey = Extract<keyof typeof m, `workspace_${string}`>;
export function useWorkspaceText() {
  const locale = useLocale();
  // oxlint-disable-next-line import/namespace -- the type limits keys to workspace messages
  return (key: CopyKey) => m[key]({}, { locale });
}

export function errorKey(error: unknown): CopyKey {
  const code = apiErrorCode(error);
  if (code === "result_not_reviewed") return "workspace_export_help";
  if (code === "processing_in_progress") return "workspace_running";
  if (code === "recording_too_large") return "workspace_file_limit";
  if (code === "version_conflict") return "workspace_conflict";
  if (code === "transcription_unavailable") return "workspace_unavailable";
  if (code === "not_found") return "workspace_no_access";
  if (
    [
      "validation_error",
      "invalid_assignee",
      "invalid_source_segment",
      "review_too_large",
    ].includes(code ?? "")
  )
    return "workspace_invalid";
  return "workspace_request_failed";
}

export const selectClass =
  "w-full rounded-md border bg-background px-3 py-2 text-sm";
export const sectionClass = "space-y-4 rounded-2xl border bg-card p-4 sm:p-6";
export const zones = [
  { name: "Asia/Almaty" },
  { name: "Europe/Moscow" },
  { name: "UTC" },
];

export function localDateInput(zone: string) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
  return parts.replace(" ", "T");
}

/** Interpret the meeting's wall clock in the selected IANA zone, not browser time. */
export function meetingInstant(value: string, timeZone: string) {
  const wallClock = Date.parse(`${value}Z`);
  let instant = wallClock;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  for (let step = 0; step < 3; step++) {
    const parts = Object.fromEntries(
      formatter.formatToParts(instant).map((part) => [part.type, part.value])
    );
    const represented = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute)
    );
    instant += wallClock - represented;
  }
  return new Date(instant).toISOString();
}

export async function uploadFile(meetingId: string, file: File) {
  const created = await createRecording({
    client: backendClient,
    path: { meeting_id: meetingId },
    throwOnError: true,
    body: {
      source: "file",
      original_filename: file.name,
      content_type: file.type || "application/octet-stream",
    },
  });
  const uploaded = await uploadRecordingFile({
    client: backendClient,
    path: { meeting_id: meetingId, recording_id: created.data.id },
    body: file,
    throwOnError: true,
  });
  return uploaded.data;
}

export const lines = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
