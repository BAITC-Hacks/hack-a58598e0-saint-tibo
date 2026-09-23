import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertCircle, FileAudio, Plus, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import type { ProcessingJobRead, RecordingRead } from "#/shared/api";
import { useLocale } from "#/shared/lib/locales";
import { Button } from "#/shared/ui/shadcn/button";
import { Input } from "#/shared/ui/shadcn/input";

import {
  addParticipant,
  jobsQuery,
  meetingQuery,
  participantsQuery,
  recordingsQuery,
  startProcessing,
  uploadFile,
} from "../api/meetings";
import { reviewQuery } from "../api/review";
import { useCopy } from "../lib/copy";
import { ReviewPanel } from "./review-panel";

export function MeetingPage({ meetingId }: { meetingId: string }) {
  const t = useCopy();
  const locale = useLocale();
  const client = useQueryClient();
  const meeting = useQuery(meetingQuery(meetingId));
  const participants = useQuery(participantsQuery(meetingId));
  const recordings = useQuery(recordingsQuery(meetingId));
  const review = useQuery(reviewQuery(meetingId));
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [participantError, setParticipantError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [processingError, setProcessingError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState(0);
  const add = useMutation({
    mutationFn: (body: { display_name: string; role: string | null }) =>
      addParticipant(meetingId, body),
  });
  const process = useMutation({
    mutationFn: ({
      recordingId,
      retryOfJobId,
    }: {
      recordingId: string;
      retryOfJobId?: string;
    }) => startProcessing(meetingId, recordingId, retryOfJobId),
  });
  const latestRecording = recordings.data?.items[0] ?? null;
  const jobs = useQuery({
    ...jobsQuery(meetingId, latestRecording?.id ?? ""),
    enabled: !!latestRecording,
  });
  const latestJob = jobs.data?.items[0] ?? null;
  const result = review.data;
  const refetchReview = review.refetch;

  useEffect(() => {
    if (latestJob?.status === "succeeded") void refetchReview();
  }, [latestJob?.status, refetchReview]);

  if (meeting.isPending)
    return <output className="block rounded-xl border p-8">{t.loading}</output>;
  if (meeting.isError || !meeting.data)
    return (
      <div role="alert" className="rounded-xl border border-destructive/40 p-8">
        <p>{t.error}</p>
        <Button
          className="mt-3"
          variant="outline"
          onClick={() => void meeting.refetch()}
        >
          {t.retry}
        </Button>
      </div>
    );

  async function submitUpload(file: File | null) {
    if (!file) return;
    setUploadError("");
    setUploading(true);
    setUploadStep(0);
    try {
      await uploadFile(meetingId, file, setUploadStep);
      await client.invalidateQueries({ queryKey: ["recordings", meetingId] });
    } catch (reason) {
      setUploadError(reason instanceof Error ? reason.message : t.error);
    } finally {
      setUploading(false);
    }
  }

  async function submitProcessing(
    recording: RecordingRead,
    retryOfJobId?: string
  ) {
    setProcessingError("");
    try {
      await process.mutateAsync({ recordingId: recording.id, retryOfJobId });
      await client.invalidateQueries({
        queryKey: ["jobs", meetingId, recording.id],
      });
    } catch (reason) {
      setProcessingError(reason instanceof Error ? reason.message : t.error);
    }
  }

  return (
    <section className="mx-auto max-w-6xl space-y-7">
      <Link
        className="text-sm text-muted-foreground hover:underline"
        to="/meetings"
      >
        ← {t.back}
      </Link>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {meeting.data.title}
        </h1>
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <time dateTime={meeting.data.started_at}>
            {new Intl.DateTimeFormat(locale, {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: meeting.data.timezone,
            }).format(new Date(meeting.data.started_at))}
          </time>
          <span>· {meeting.data.timezone}</span>
        </div>
      </header>

      {import.meta.env.DEV && import.meta.env.VITE_API_MODE === "mock" && (
        <p className="rounded-lg border border-amber-400/50 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          {t.sample}
        </p>
      )}
      <p className="rounded-xl border bg-muted/40 p-4 text-sm">{t.notice}</p>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <section className="rounded-xl border bg-card p-5">
            <h2 className="font-semibold">{t.recordings}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t.uploadHelp}</p>
            <label className="mt-4 block cursor-pointer rounded-lg border border-dashed p-5 text-center focus-within:outline-2 focus-within:outline-ring hover:bg-muted/40">
              <FileAudio
                className="mx-auto mb-2 size-6 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="text-sm font-medium">
                {uploading ? t.uploading : t.upload}
              </span>
              <input
                className="sr-only"
                type="file"
                accept="audio/*,video/mp4,.flac,.ogg,.webm,.m4a"
                disabled={uploading}
                onChange={(event) => {
                  void submitUpload(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
              />
            </label>
            {uploading && (
              <output className="mt-3 block text-sm">
                {t.uploading}{" "}
                {uploadStep === 0 ? "" : uploadStep === 10 ? "·" : "✓"}
              </output>
            )}
            {uploadError && (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {uploadError} · {t.retryUpload}
              </p>
            )}
            {recordings.isPending ? (
              <output className="mt-4 block text-sm text-muted-foreground">
                {t.loading}
              </output>
            ) : recordings.isError ? (
              <div role="alert" className="mt-4">
                <p className="text-sm text-destructive">{t.error}</p>
                <Button
                  variant="outline"
                  onClick={() => void recordings.refetch()}
                >
                  {t.retry}
                </Button>
              </div>
            ) : recordings.data?.items.length ? (
              <ul className="mt-4 divide-y rounded-lg border">
                {recordings.data.items.map((recording) => (
                  <li
                    key={recording.id}
                    className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
                  >
                    <span className="min-w-0 truncate">
                      {recording.original_filename}
                    </span>
                    <span
                      className={
                        recording.status === "failed"
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }
                    >
                      {recording.status === "ready"
                        ? t.recordingReady
                        : recording.status === "failed"
                          ? t.failed
                          : recording.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                {t.noRecording}
              </p>
            )}
          </section>

          <section className="rounded-xl border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">{t.processing}</h2>
              {latestRecording?.status === "ready" &&
                (!latestJob ||
                  ["failed", "interrupted"].includes(latestJob.status)) && (
                  <Button
                    disabled={process.isPending}
                    onClick={() =>
                      void submitProcessing(latestRecording, latestJob?.id)
                    }
                  >
                    {latestJob ? (
                      <RefreshCw aria-hidden="true" />
                    ) : (
                      <Plus aria-hidden="true" />
                    )}
                    {latestJob ? t.retryProcessing : t.startProcessing}
                  </Button>
                )}
            </div>
            {processingError && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {processingError}
              </p>
            )}
            {latestRecording && jobs.isPending ? (
              <output className="mt-4 block text-sm">{t.loading}</output>
            ) : jobs.isError ? (
              <div role="alert" className="mt-4">
                <p>{t.error}</p>
                <Button variant="outline" onClick={() => void jobs.refetch()}>
                  {t.retry}
                </Button>
              </div>
            ) : latestJob ? (
              <JobStatus job={latestJob} />
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                {t.noResultHelp}
              </p>
            )}
          </section>
        </div>

        <aside className="rounded-xl border bg-card p-5 lg:self-start">
          <h2 className="font-semibold">
            {t.participants} {participants.data ? participants.data.total : ""}
          </h2>
          {participants.isPending ? (
            <output className="mt-4 block text-sm">{t.loading}</output>
          ) : participants.isError ? (
            <div role="alert" className="mt-4">
              <p>{t.error}</p>
              <Button
                variant="outline"
                onClick={() => void participants.refetch()}
              >
                {t.retry}
              </Button>
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {participants.data?.items.map((participant) => (
                <li
                  key={participant.id}
                  className="rounded-lg border p-2.5 text-sm"
                >
                  <strong className="block font-medium">
                    {participant.display_name}
                  </strong>
                  <span className="text-muted-foreground">
                    {participant.role || t.unknown}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <form
            className="mt-5 space-y-2 border-t pt-4"
            onSubmit={(event) => {
              event.preventDefault();
              setParticipantError("");
              add.mutate(
                { display_name: name.trim(), role: role.trim() || null },
                {
                  onSuccess: () => {
                    setName("");
                    setRole("");
                    void client.invalidateQueries({
                      queryKey: ["participants", meetingId],
                    });
                  },
                  onError: (reason) =>
                    setParticipantError(
                      reason instanceof Error ? reason.message : t.error
                    ),
                }
              );
            }}
          >
            <label className="block text-sm">
              <span>{t.name}</span>
              <Input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span>{t.role}</span>
              <Input
                value={role}
                onChange={(event) => setRole(event.target.value)}
              />
            </label>
            {participantError && (
              <p role="alert" className="text-sm text-destructive">
                {participantError}
              </p>
            )}
            <Button
              type="submit"
              variant="outline"
              disabled={!name.trim() || add.isPending}
            >
              {t.add}
            </Button>
          </form>
        </aside>
      </div>

      {review.isPending ? (
        <output className="block rounded-xl border p-8">{t.loading}</output>
      ) : review.isError ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/40 p-6"
        >
          <p>{t.error}</p>
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => void review.refetch()}
          >
            {t.retry}
          </Button>
        </div>
      ) : result ? (
        <ReviewPanel
          key={`${result.result_version_id}:${result.revision}`}
          meetingId={meetingId}
          review={result}
          participants={participants.data?.items ?? []}
          recording={
            recordings.data?.items.find(
              (recording) => recording.id === result.segments[0]?.recording_id
            ) ?? latestRecording
          }
        />
      ) : (
        <div className="rounded-xl border border-dashed p-8">
          <AlertCircle
            className="mb-2 size-6 text-muted-foreground"
            aria-hidden="true"
          />
          <h2 className="font-medium">{t.noResult}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.noResultHelp}</p>
        </div>
      )}
    </section>
  );
}

function JobStatus({ job }: { job: ProcessingJobRead }) {
  const t = useCopy();
  const label =
    job.status === "queued"
      ? t.queued
      : job.status === "running"
        ? t.running
        : job.status === "succeeded"
          ? t.succeeded
          : t.failed;
  return (
    <div className="mt-4 space-y-2">
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <span>
          {label} · {job.stage}
        </span>
        {job.progress !== null && (
          <span>{Math.round(job.progress * 100)}%</span>
        )}
      </div>
      {job.progress !== null && (
        <progress
          className="w-full"
          max={1}
          value={job.progress}
          aria-label={t.processing}
        />
      )}
      {job.error_code && (
        <p role="alert" className="text-sm text-destructive">
          {job.error_code}
        </p>
      )}
    </div>
  );
}
