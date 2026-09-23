import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import {
  backendClient,
  createMeetingMutation,
  createParticipantMutation,
  createProcessingJobMutation,
  getResultReviewOptions,
  listMeetingsOptions,
  listParticipantsOptions,
  listProcessingJobsOptions,
  listRecordingsOptions,
  listResultVersionsOptions,
  listTranscriptSegmentsInfiniteOptions,
} from "#/shared/api";
import type {
  MeetingRead,
  ProcessingJobCreate,
  RecordingRead,
} from "#/shared/api";
import { MeetingPlayer } from "#/shared/ui/meeting-player";
import type { MeetingPlayerHandle } from "#/shared/ui/meeting-player";
import { Button } from "#/shared/ui/shadcn/button";
import { Input } from "#/shared/ui/shadcn/input";
import {
  TranscriptPanel,
  useTranscriptSync,
} from "#/shared/ui/transcript-sync";

import {
  errorKey,
  localDateInput,
  meetingInstant,
  sectionClass,
  selectClass,
  uploadFile,
  useWorkspaceText,
  zones,
} from "../lib/workspace";
import { ReviewEditor } from "./review-editor";

function RequestError({ error }: { error: unknown }) {
  const t = useWorkspaceText();
  return error ? (
    <p role="alert" className="text-sm text-destructive">
      {t(errorKey(error))}
    </p>
  ) : null;
}

export function WorkspacePage() {
  const t = useWorkspaceText();
  const [selected, setSelected] = useState("");
  const [offset, setOffset] = useState(0);
  const meetings = useQuery(
    listMeetingsOptions({ client: backendClient, query: { limit: 20, offset } })
  );
  const form = useForm({
    defaultValues: {
      title: "",
      started: localDateInput("Asia/Almaty"),
      timezone: "Asia/Almaty",
    },
  });
  const create = useMutation({
    ...createMeetingMutation({ client: backendClient }),
    onError: () => {},
    onSuccess: async (meeting) => {
      setOffset(0);
      setSelected(meeting.id);
      form.reset({
        title: "",
        started: localDateInput("Asia/Almaty"),
        timezone: "Asia/Almaty",
      });
      await meetings.refetch();
    },
  });
  const current =
    meetings.data?.items.find((item) => item.id === selected) ??
    meetings.data?.items[0];
  return (
    <main className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("workspace_title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("workspace_intro")}</p>
      </header>
      <section className={sectionClass}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t("workspace_meetings")}</h2>
          <Button
            variant="outline"
            onClick={() => void meetings.refetch()}
            disabled={meetings.isFetching}
          >
            {t("workspace_refresh")}
          </Button>
        </div>
        <RequestError error={meetings.error} />
        {meetings.isPending && <output>{t("workspace_loading")}</output>}
        {meetings.data?.items.length === 0 && (
          <p>{t("workspace_empty_meetings")}</p>
        )}
        {!!meetings.data?.items.length && (
          <label className="block space-y-2 text-sm">
            <span>{t("workspace_meetings")}</span>
            <select
              className={selectClass}
              value={current?.id ?? ""}
              onChange={(event) => setSelected(event.target.value)}
            >
              {meetings.data.items.map((meeting) => (
                <option key={meeting.id} value={meeting.id}>
                  {meeting.title}
                </option>
              ))}
            </select>
          </label>
        )}
        {!!meetings.data && meetings.data.total > 20 && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={!offset}
              onClick={() => setOffset(Math.max(0, offset - 20))}
            >
              {t("workspace_previous")}
            </Button>
            <Button
              variant="outline"
              disabled={offset + 20 >= meetings.data.total}
              onClick={() => setOffset(offset + 20)}
            >
              {t("workspace_next")}
            </Button>
          </div>
        )}
        <details
          open={!meetings.data?.items.length}
          className="rounded-lg border p-3"
        >
          <summary className="cursor-pointer font-medium">
            {t("workspace_new_meeting")}
          </summary>
          <form
            className="mt-4 grid gap-3 sm:grid-cols-2"
            onSubmit={(event) =>
              void form.handleSubmit((data) => {
                const zone = zones.find((item) => item.name === data.timezone)!;
                create.mutate({
                  body: {
                    title: data.title.trim(),
                    started_at: meetingInstant(data.started, zone.name),
                    timezone: zone.name,
                  },
                });
              })(event)
            }
          >
            <label className="space-y-1 text-sm sm:col-span-2">
              <span>{t("workspace_meeting_title")}</span>
              <Input
                required
                maxLength={200}
                {...form.register("title", { required: true })}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>{t("workspace_date")}</span>
              <Input
                required
                type="datetime-local"
                {...form.register("started", { required: true })}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>{t("workspace_timezone")}</span>
              <select className={selectClass} {...form.register("timezone")}>
                {zones.map((zone) => (
                  <option key={zone.name}>{zone.name}</option>
                ))}
              </select>
            </label>
            <Button type="submit" disabled={create.isPending}>
              {t(create.isPending ? "workspace_busy" : "workspace_create")}
            </Button>
            <RequestError error={create.error} />
          </form>
        </details>
      </section>
      {current && <MeetingWorkspace key={current.id} meeting={current} />}
    </main>
  );
}

function MeetingWorkspace({ meeting }: { meeting: MeetingRead }) {
  const t = useWorkspaceText();
  const [recordingId, setRecordingId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const path = { meeting_id: meeting.id };
  const participants = useQuery(
    listParticipantsOptions({
      client: backendClient,
      path,
      query: { limit: 100 },
    })
  );
  const recordings = useQuery(
    listRecordingsOptions({
      client: backendClient,
      path,
      query: { limit: 100 },
    })
  );
  const form = useForm({ defaultValues: { name: "", role: "" } });
  const add = useMutation({
    ...createParticipantMutation({ client: backendClient }),
    onError: () => {},
    onSuccess: async () => {
      form.reset();
      await participants.refetch();
    },
  });
  const upload = useMutation({
    mutationFn: (chosen: File) => uploadFile(meeting.id, chosen),
    onSuccess: async (recording) => {
      setRecordingId(recording.id);
      setFile(null);
      if (input.current) input.current.value = "";
      await recordings.refetch();
    },
    onError: async () => {
      await recordings.refetch();
    },
  });
  const current =
    recordings.data?.items.find((item) => item.id === recordingId) ??
    recordings.data?.items[0];
  const fileValid = !!file && file.size > 0 && file.size <= 512 * 1024 * 1024;
  return (
    <>
      <section className={sectionClass}>
        <h2 className="text-xl font-semibold">{meeting.title}</h2>
        <p className="text-sm text-muted-foreground">
          {new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: meeting.timezone,
          }).format(new Date(meeting.started_at))}{" "}
          · {meeting.timezone}
        </p>
        <h3 className="font-semibold">{t("workspace_participants")}</h3>
        <RequestError error={participants.error} />
        <ul className="flex flex-wrap gap-2">
          {participants.data?.items.map((participant) => (
            <li
              className="rounded-full bg-muted px-3 py-1 text-sm"
              key={participant.id}
            >
              {participant.display_name}
              {participant.role && ` · ${participant.role}`}
            </li>
          ))}
        </ul>
        {participants.data?.items.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t("workspace_empty_participants")}
          </p>
        )}
        <form
          className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={(event) =>
            void form.handleSubmit((data) =>
              add.mutate({
                path,
                body: {
                  display_name: data.name.trim(),
                  role: data.role.trim() || null,
                },
              })
            )(event)
          }
        >
          <label className="space-y-1 text-sm">
            <span>{t("workspace_participant_name")}</span>
            <Input
              required
              maxLength={200}
              {...form.register("name", { required: true })}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>{t("workspace_participant_role")}</span>
            <Input maxLength={200} {...form.register("role")} />
          </label>
          <Button type="submit" disabled={add.isPending}>
            {t("workspace_add")}
          </Button>
        </form>
        <RequestError error={add.error} />
      </section>
      <section className={sectionClass}>
        <h2 className="text-lg font-semibold">{t("workspace_recordings")}</h2>
        <label className="block space-y-2 text-sm">
          <span>{t("workspace_audio_file")}</span>
          <Input
            ref={input}
            type="file"
            accept="audio/*,video/*,.mp3,.wav,.m4a,.ogg,.webm,.mp4"
            disabled={upload.isPending}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <p className="text-sm text-muted-foreground">
          {t("workspace_upload_help")}
        </p>
        {file && !fileValid && (
          <p role="alert" className="text-destructive">
            {t("workspace_file_limit")}
          </p>
        )}
        <Button
          disabled={!fileValid || upload.isPending}
          onClick={() => {
            if (file) upload.mutate(file);
          }}
        >
          {t(upload.isPending ? "workspace_uploading" : "workspace_upload")}
        </Button>
        <RequestError error={upload.error || recordings.error} />
        {recordings.isPending && <output>{t("workspace_loading")}</output>}
        {recordings.data?.items.length === 0 && (
          <p>{t("workspace_empty_recordings")}</p>
        )}
        {!!recordings.data?.items.length && (
          <label className="block space-y-2 text-sm">
            <span>{t("workspace_recordings")}</span>
            <select
              className={selectClass}
              value={current?.id ?? ""}
              disabled={upload.isPending}
              onChange={(event) => setRecordingId(event.target.value)}
            >
              {recordings.data.items.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.original_filename}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>
      {current && (
        <RecordingWorkspace
          key={current.id}
          meetingId={meeting.id}
          recording={current}
        />
      )}
    </>
  );
}

const LANGUAGES: readonly NonNullable<ProcessingJobCreate["language"]>[] = [
  "auto",
  "ru",
  "kk",
  "mixed",
];

function RecordingWorkspace({
  meetingId,
  recording,
}: {
  meetingId: string;
  recording: RecordingRead;
}) {
  const t = useWorkspaceText();
  const path = { meeting_id: meetingId, recording_id: recording.id };
  const [language, setLanguage] =
    useState<NonNullable<ProcessingJobCreate["language"]>>("auto");
  const [allowIncomplete, setAllowIncomplete] = useState(false);
  const [resultId, setResultId] = useState("");
  const requestKey = useRef<string | null>(null);
  const jobs = useQuery({
    ...listProcessingJobsOptions({
      client: backendClient,
      path,
      query: { limit: 20 },
    }),
    refetchInterval: (query) =>
      query.state.data?.items.some((job) =>
        ["queued", "running"].includes(job.status)
      )
        ? 2000
        : false,
    refetchOnWindowFocus: true,
  });
  const results = useQuery(
    listResultVersionsOptions({
      client: backendClient,
      path,
      query: { limit: 100 },
    })
  );
  const refetchResults = results.refetch;
  const latest = jobs.data?.items[0];
  const active =
    jobs.data?.items.some((job) =>
      ["queued", "running"].includes(job.status)
    ) ?? false;
  const start = useMutation({
    ...createProcessingJobMutation({ client: backendClient }),
    onError: () => {},
    onSuccess: async () => {
      requestKey.current = null;
      setResultId("");
      await jobs.refetch();
    },
  });
  const selectedResultId =
    resultId ||
    (latest?.status === "succeeded" ? latest.result_version_id : "");
  const result =
    results.data?.items.find((item) => item.id === selectedResultId) ??
    results.data?.items[0];
  useEffect(() => {
    if (latest?.status === "succeeded" && latest.result_version_id) {
      void refetchResults();
    }
  }, [latest?.id, latest?.status, latest?.result_version_id, refetchResults]);
  const canProcess =
    !!recording.media_url &&
    (recording.status === "ready" ||
      (recording.status === "incomplete" && allowIncomplete));
  const statusKey =
    latest?.error_code === "transcription_unavailable"
      ? "workspace_unavailable"
      : latest
        ? (`workspace_${latest.status}` as const)
        : null;
  return (
    <>
      <section className={sectionClass}>
        {recording.status === "incomplete" && (
          <output className="block font-medium">
            {t("workspace_incomplete")}
          </output>
        )}
        {recording.status === "receiving" && <p>{t("workspace_receiving")}</p>}
        {recording.status === "failed" && (
          <p role="alert">{t("workspace_failed")}</p>
        )}
        {recording.status === "ready" && <p>{t("workspace_ready")}</p>}
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">
            <span>{t("workspace_language")}</span>
            <select
              className={selectClass}
              value={language}
              disabled={active || start.isPending}
              onChange={(event) => {
                const next = LANGUAGES.find(
                  (value) => value === event.target.value
                );
                if (next) setLanguage(next);
                requestKey.current = null;
              }}
            >
              <option value="auto">{t("workspace_auto")}</option>
              <option value="ru">Русский</option>
              <option value="kk">Қазақша</option>
              <option value="mixed">{t("workspace_mixed")}</option>
            </select>
          </label>
          <Button
            disabled={
              !canProcess || active || start.isPending || jobs.isPending
            }
            onClick={() => {
              requestKey.current ??= crypto.randomUUID();
              start.mutate({
                path,
                body: {
                  request_key: requestKey.current,
                  language,
                  allow_incomplete: allowIncomplete,
                  target_stage: "transcribe",
                  retry_of_job_id:
                    latest && ["failed", "interrupted"].includes(latest.status)
                      ? latest.id
                      : null,
                },
              });
            }}
          >
            {t(
              start.isPending || active
                ? "workspace_running"
                : "workspace_process"
            )}
          </Button>
        </div>
        {recording.status === "incomplete" && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allowIncomplete}
              disabled={active}
              onChange={(event) => {
                setAllowIncomplete(event.target.checked);
                requestKey.current = null;
              }}
            />
            {t("workspace_allow_incomplete")}
          </label>
        )}
        <RequestError error={start.error || jobs.error || results.error} />
        {statusKey && (
          <output>
            {t(statusKey)}
            {latest?.progress != null && active
              ? ` · ${Math.round(latest.progress * 100)}%`
              : ""}
          </output>
        )}
        <p className="text-sm text-muted-foreground">
          {t("workspace_manual_notice")}
        </p>
        {!result && !results.isPending && <p>{t("workspace_no_results")}</p>}
        {!!results.data?.items.length && (
          <label className="block space-y-2 text-sm">
            <span>{t("workspace_versions")}</span>
            <select
              className={selectClass}
              value={result?.id}
              onChange={(event) => setResultId(event.target.value)}
            >
              {results.data.items.map((row) => (
                <option key={row.id} value={row.id}>
                  {new Date(row.created_at).toLocaleString()} ·{" "}
                  {t(
                    row.status === "reviewed"
                      ? "workspace_reviewed"
                      : "workspace_draft"
                  )}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>
      {result ? (
        <ResultWorkspace
          key={result.id}
          meetingId={meetingId}
          recording={recording}
          resultId={result.id}
          onResultUpdated={async () => {
            await results.refetch();
          }}
        />
      ) : (
        recording.media_url && (
          <MeetingPlayer
            source={{
              id: recording.id,
              url: recording.media_url,
              title: recording.original_filename,
            }}
          />
        )
      )}
    </>
  );
}

function ResultWorkspace({
  meetingId,
  recording,
  resultId,
  onResultUpdated,
}: {
  meetingId: string;
  recording: RecordingRead;
  resultId: string;
  onResultUpdated: () => Promise<void>;
}) {
  const t = useWorkspaceText();
  const player = useRef<MeetingPlayerHandle>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const path = {
    meeting_id: meetingId,
    recording_id: recording.id,
    result_version_id: resultId,
  };
  const segments = useInfiniteQuery({
    ...listTranscriptSegmentsInfiniteOptions({
      client: backendClient,
      path,
      query: { limit: 100 },
    }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.offset + lastPage.items.length < lastPage.total
        ? lastPage.offset + lastPage.items.length
        : undefined,
  });
  const rows = segments.data?.pages.flatMap((page) => page.items) ?? [];
  const review = useQuery({
    ...getResultReviewOptions({ client: backendClient, path }),
    refetchOnWindowFocus: false,
  });
  const sync = useTranscriptSync({
    recordingId: recording.id,
    resultVersionId: resultId,
    segments: rows,
    seek: (ms) => player.current?.seek(ms),
  });
  return (
    <>
      {recording.media_url && (
        <MeetingPlayer
          ref={player}
          source={{
            id: recording.id,
            url: recording.media_url,
            title: recording.original_filename,
          }}
          onPositionChange={sync.onPositionChange}
        />
      )}
      <RequestError error={segments.error || review.error} />
      {segments.isPending && <output>{t("workspace_loading")}</output>}
      {segments.isSuccess && rows.length === 0 && (
        <p>{t("workspace_empty_transcript")}</p>
      )}
      {!!rows.length && <TranscriptPanel sync={sync} />}
      {segments.hasNextPage && (
        <Button
          variant="outline"
          disabled={segments.isFetchingNextPage}
          onClick={() => void segments.fetchNextPage()}
        >
          {t("workspace_more")}
        </Button>
      )}
      {review.data && (
        <ReviewEditor
          key={`${resultId}:${review.data.revision}:${reloadKey}`}
          initial={review.data}
          path={path}
          segments={rows}
          onReload={async () => {
            const response = await review.refetch({ throwOnError: true });
            if (response.data) setReloadKey((value) => value + 1);
          }}
          onSaved={async () => {
            await Promise.all([review.refetch(), onResultUpdated()]);
          }}
          onSeek={(id) => sync.seekSegment(id)}
        />
      )}
    </>
  );
}
