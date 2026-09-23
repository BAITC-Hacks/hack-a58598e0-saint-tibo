import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import type { ParticipantRead, RecordingRead } from "#/shared/api";
import { MeetingPlayer } from "#/shared/ui/meeting-player";
import type { MeetingPlayerHandle } from "#/shared/ui/meeting-player";
import { Button } from "#/shared/ui/shadcn/button";
import { Input } from "#/shared/ui/shadcn/input";
import { Textarea } from "#/shared/ui/shadcn/textarea";
import { transcriptTime, useTranscriptSync } from "#/shared/ui/transcript-sync";

import {
  downloadReview,
  reloadReview,
  ReviewConflictError,
  saveReview,
} from "../api/review";
import type { ReviewDocument } from "../api/review";
import { useCopy } from "../lib/copy";

type Tab = "summary" | "transcript" | "actions";
const actionStatuses = ["open", "in_progress", "done", "cancelled"] as const;

export function ReviewPanel({
  meetingId,
  review,
  participants,
  recording,
}: {
  meetingId: string;
  review: ReviewDocument;
  participants: ParticipantRead[];
  recording: RecordingRead | null;
}) {
  const t = useCopy();
  const client = useQueryClient();
  const [draft, setDraft] = useState(review);
  const [tab, setTab] = useState<Tab>("summary");
  const [search, setSearch] = useState("");
  const [speakerFilter, setSpeakerFilter] = useState("");
  const [saveError, setSaveError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [exportError, setExportError] = useState("");
  const player = useRef<MeetingPlayerHandle>(null);
  const transcriptBox = useRef<HTMLDivElement>(null);
  const sync = useTranscriptSync({
    recordingId: recording?.id ?? "",
    resultVersionId: review.result_version_id,
    segments: review.segments,
    seek: (ms) => player.current?.seek(ms),
  });
  const dirty = JSON.stringify(draft) !== JSON.stringify(review);
  const canEdit = true;
  const save = useMutation({
    mutationFn: (next: ReviewDocument) => saveReview(meetingId, next),
    onError: () => {}, // Localized errors, including the explicit conflict action below.
  });
  const reload = useMutation({
    mutationFn: () => reloadReview(meetingId, review),
    onError: () => {},
  });
  const download = useMutation({
    mutationFn: (format: "pdf" | "docx") =>
      downloadReview(meetingId, format, review),
  });
  function editDraft(update: (current: ReviewDocument) => ReviewDocument) {
    setDraft((current) => ({ ...update(current), reviewed: false }));
  }
  const canPlay =
    recording?.status === "ready" || recording?.status === "incomplete";
  const segmentById = new Map(
    review.segments.map((segment) => [segment.id, segment])
  );
  const participantById = new Map(
    participants.map((participant) => [participant.id, participant])
  );
  const speakerById = new Map(
    draft.speakers.map((speaker) => [speaker.id, speaker])
  );
  const selectedSegments = review.segments
    .filter(
      (segment) =>
        (!speakerFilter || segment.speaker_id === speakerFilter) &&
        segment.text.toLocaleLowerCase().includes(search.toLocaleLowerCase())
    )
    .toSorted((a, b) => a.start_ms - b.start_ms);

  useEffect(() => {
    if (tab !== "transcript" || !sync.activeSegmentId || !sync.follow) return;
    transcriptBox.current
      ?.querySelector(`[data-segment-id="${CSS.escape(sync.activeSegmentId)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [tab, sync.activeSegmentId, sync.follow]);

  const source =
    recording && canPlay
      ? {
          id: recording.id,
          url: `/api/media/meetings/${meetingId}/recordings/${recording.id}`,
          title: recording.original_filename,
        }
      : null;

  function seekSource(id: string) {
    const segment = segmentById.get(id);
    if (!segment) return;
    if (source) sync.seekSegment(id);
    setTab("transcript");
    setSpeakerFilter("");
    setSearch("");
    requestAnimationFrame(() =>
      transcriptBox.current
        ?.querySelector(`[data-segment-id="${CSS.escape(id)}"]`)
        ?.scrollIntoView({ block: "center" })
    );
  }

  async function exportFile(format: "pdf" | "docx") {
    setExportError("");
    try {
      await download.mutateAsync(format);
    } catch (reason) {
      setExportError(
        reason instanceof Error ? reason.message : t.exportUnavailable
      );
    }
  }

  return (
    <section className="space-y-5" aria-label={t.review}>
      {review.source === "mock" && (
        <p className="rounded-lg border border-amber-400/50 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          {t.sample}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t.review}</h2>
          <p className="text-sm text-muted-foreground">
            {review.reviewed ? t.resultSaved : t.resultDraft} ·{" "}
            {dirty ? t.unsaved : t.saved}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={!canEdit || save.isPending || reload.isPending}
              checked={draft.reviewed}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  reviewed: event.target.checked,
                }))
              }
            />
            {t.markReviewed}
          </label>
          <Button
            disabled={!canEdit || !dirty || save.isPending || reload.isPending}
            onClick={() => {
              setSaveError("");
              save.mutate(draft, {
                onSuccess: (saved) => {
                  setConflict(false);
                  setDraft(saved);
                  client.setQueryData(["review", meetingId], saved);
                },
                onError: (reason) => {
                  const stale = reason instanceof ReviewConflictError;
                  setConflict(stale);
                  setSaveError(stale ? "" : t.saveError);
                },
              });
            }}
          >
            {save.isPending ? t.loading : t.save}
          </Button>
          <Button
            variant="outline"
            disabled={
              !canEdit || dirty || !review.reviewed || download.isPending
            }
            onClick={() => void exportFile("pdf")}
          >
            {t.pdf}
          </Button>
          <Button
            variant="outline"
            disabled={
              !canEdit || dirty || !review.reviewed || download.isPending
            }
            onClick={() => void exportFile("docx")}
          >
            {t.docx}
          </Button>
        </div>
      </div>
      {(saveError || exportError) && (
        <p role="alert" className="text-sm text-destructive">
          {saveError || exportError}
        </p>
      )}
      {conflict && (
        <div role="alert" className="space-y-2 rounded-lg border border-destructive/40 p-3">
          <p className="text-sm">{t.reviewConflict}</p>
          <Button
            variant="outline"
            disabled={reload.isPending || save.isPending}
            onClick={() => {
              setSaveError("");
              reload.mutate(undefined, {
                onSuccess: (loaded) => {
                  setDraft(loaded);
                  setConflict(false);
                  client.setQueryData(["review", meetingId], loaded);
                },
                onError: () => setSaveError(t.reviewReloadError),
              });
            }}
          >
            {reload.isPending ? t.loading : t.reviewReload}
          </Button>
          <p className="text-xs text-muted-foreground">{t.reviewReloadHelp}</p>
        </div>
      )}
      {(!canEdit || !review.reviewed || dirty) && (
        <p className="text-sm text-muted-foreground">
          {canEdit ? t.exportUnavailable : t.detailsUnavailable}
        </p>
      )}

      {source && (
        <MeetingPlayer
          ref={player}
          source={source}
          onPositionChange={sync.onPositionChange}
        />
      )}

      <fieldset disabled={save.isPending || reload.isPending} className="contents">
      <div
        className="flex flex-wrap gap-1 rounded-lg bg-muted p-1"
        role="tablist"
        aria-label={t.review}
      >
        {(["summary", "transcript", "actions"] as Tab[]).map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            onClick={() => setTab(name)}
            className="rounded-md px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-ring aria-selected:bg-background aria-selected:shadow-sm"
          >
            {t[name]}
            {name === "transcript"
              ? ` (${review.segments.length})`
              : name === "actions"
                ? ` (${draft.action_items.length})`
                : ""}
          </button>
        ))}
      </div>

      {tab === "summary" && !canEdit && (
        <p className="rounded-xl border p-5 text-sm text-muted-foreground">
          {t.detailsUnavailable}
        </p>
      )}
      {tab === "summary" && canEdit && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="space-y-5">
            {(["topics", "decisions", "open_questions"] as const).map(
              (section) => (
                <section
                  key={section}
                  className="rounded-xl border bg-card p-4"
                >
                  <h3 className="mb-3 font-medium">
                    {section === "topics"
                      ? t.topics
                      : section === "decisions"
                        ? t.decisions
                        : t.openQuestions}
                  </h3>
                  <div className="space-y-3">
                    {draft.summary[section].map((entry, index) => (
                      <div key={`${section}-${index}`} className="space-y-1">
                        <Textarea
                          aria-label={`${section} ${index + 1}`}
                          value={entry.text}
                          onChange={(event) =>
                            editDraft((current) => ({
                              ...current,
                              summary: {
                                ...current.summary,
                                [section]: current.summary[section].map(
                                  (item, i) =>
                                    i === index
                                      ? { ...item, text: event.target.value }
                                      : item
                                ),
                              },
                            }))
                          }
                        />
                        {entry.source_segment_ids.map((id) => (
                          <button
                            key={id}
                            className="text-xs text-primary underline"
                            type="button"
                            disabled={!segmentById.has(id)}
                            onClick={() => seekSource(id)}
                          >
                            {t.source}{" "}
                            {transcriptTime(segmentById.get(id)?.start_ms ?? 0)}
                          </button>
                        ))}
                      </div>
                    ))}
                    {draft.summary[section].length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        {t.noItems}
                      </p>
                    )}
                  </div>
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      editDraft((current) => ({
                        ...current,
                        summary: {
                          ...current.summary,
                          [section]: [
                            ...current.summary[section],
                            { text: "", source_segment_ids: [] },
                          ],
                        },
                      }))
                    }
                  >
                    {t.add}
                  </Button>
                </section>
              )
            )}
          </div>
          <aside className="rounded-xl border bg-card p-4">
            <h3 className="font-medium">{t.speakers}</h3>
            <div className="mt-3 space-y-3">
              {draft.speakers.map((speaker, index) => (
                <label key={speaker.id} className="block space-y-1 text-sm">
                  <span>{speaker.label}</span>
                  <select
                    aria-label={`${speaker.label}: ${t.participants}`}
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={speaker.participant_id ?? ""}
                    onChange={(event) =>
                      editDraft((current) => ({
                        ...current,
                        speakers: current.speakers.map((item, i) =>
                          i === index
                            ? {
                                ...item,
                                participant_id: event.target.value || null,
                              }
                            : item
                        ),
                      }))
                    }
                  >
                    <option value="">{t.unknown}</option>
                    {participants.map((participant) => (
                      <option key={participant.id} value={participant.id}>
                        {participant.display_name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              {!draft.speakers.length && (
                <p className="text-sm text-muted-foreground">{t.noItems}</p>
              )}
            </div>
          </aside>
        </div>
      )}

      {tab === "transcript" && (
        <section className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input
              className="w-full sm:max-w-xs"
              type="search"
              aria-label={t.search}
              placeholder={t.search}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              aria-label={t.filterSpeaker}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={speakerFilter}
              onChange={(event) => setSpeakerFilter(event.target.value)}
            >
              <option value="">{t.filterSpeaker}</option>
              {draft.speakers.map((speaker) => (
                <option key={speaker.id} value={speaker.id}>
                  {participantById.get(speaker.participant_id ?? "")
                    ?.display_name ?? speaker.label}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              aria-pressed={sync.follow}
              onClick={() => sync.setFollow(!sync.follow)}
            >
              {sync.follow ? "●" : "○"} {t.followAudio}
            </Button>
          </div>
          <div
            ref={transcriptBox}
            className="max-h-[560px] space-y-1 overflow-y-auto rounded-xl border bg-card p-2"
            onWheel={() => sync.setFollow(false)}
            onTouchMove={() => sync.setFollow(false)}
          >
            {selectedSegments.map((segment) => {
              const speaker = speakerById.get(segment.speaker_id ?? "");
              return (
                <button
                  key={segment.id}
                  data-segment-id={segment.id}
                  type="button"
                  className="grid w-full grid-cols-[54px_minmax(0,1fr)] gap-3 rounded-lg p-3 text-left hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring aria-current:bg-accent"
                  aria-current={
                    sync.activeSegmentId === segment.id ? "true" : undefined
                  }
                  onClick={() => sync.seekSegment(segment.id)}
                >
                  <time className="text-xs text-muted-foreground tabular-nums">
                    {transcriptTime(segment.start_ms)}
                  </time>
                  <span>
                    <strong className="block text-sm">
                      {participantById.get(speaker?.participant_id ?? "")
                        ?.display_name ??
                        speaker?.label ??
                        t.unknown}
                    </strong>
                    <span className="text-sm">{segment.text}</span>
                  </span>
                </button>
              );
            })}
            {!selectedSegments.length && (
              <p className="p-5 text-sm text-muted-foreground">{t.noItems}</p>
            )}
          </div>
        </section>
      )}

      {tab === "actions" && !canEdit && (
        <p className="rounded-xl border p-5 text-sm text-muted-foreground">
          {t.detailsUnavailable}
        </p>
      )}
      {tab === "actions" && canEdit && (
        <section className="space-y-3">
          {draft.action_items.map((item, index) => (
            <div
              key={item.id}
              className="space-y-3 rounded-xl border bg-card p-4"
            >
              <label className="block space-y-1 text-sm">
                <span>{t.actions}</span>
                <Textarea
                  value={item.text}
                  onChange={(event) =>
                    editDraft((current) => ({
                      ...current,
                      action_items: current.action_items.map((entry, i) =>
                        i === index
                          ? { ...entry, text: event.target.value }
                          : entry
                      ),
                    }))
                  }
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block space-y-1 text-sm">
                  <span>{t.owner}</span>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-2"
                    value={item.assignee_participant_id ?? ""}
                    onChange={(event) =>
                      editDraft((current) => ({
                        ...current,
                        action_items: current.action_items.map((entry, i) =>
                          i === index
                            ? {
                                ...entry,
                                assignee_participant_id:
                                  event.target.value || null,
                                assignee_text: event.target.value
                                  ? null
                                  : entry.assignee_text,
                              }
                            : entry
                        ),
                      }))
                    }
                  >
                    <option value="">{item.assignee_text || t.unknown}</option>
                    {participants.map((participant) => (
                      <option key={participant.id} value={participant.id}>
                        {participant.display_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1 text-sm">
                  <span>{t.deadline}</span>
                  <Input
                    type="date"
                    value={item.due_date ?? ""}
                    onChange={(event) =>
                      editDraft((current) => ({
                        ...current,
                        action_items: current.action_items.map((entry, i) =>
                          i === index
                            ? { ...entry, due_date: event.target.value || null }
                            : entry
                        ),
                      }))
                    }
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span>{t.status}</span>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-2"
                    value={item.status}
                    onChange={(event) => {
                      const next = actionStatuses.find(
                        (status) => status === event.target.value
                      );
                      if (next)
                        editDraft((current) => ({
                          ...current,
                          action_items: current.action_items.map((entry, i) =>
                            i === index ? { ...entry, status: next } : entry
                          ),
                        }));
                    }}
                  >
                    <option value="open">{t.open}</option>
                    <option value="in_progress">{t.running}</option>
                    <option value="done">{t.done}</option>
                    <option value="cancelled">{t.dropped}</option>
                  </select>
                </label>
              </div>
              {item.due_text && (
                <p className="text-xs text-muted-foreground">{item.due_text}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {item.source_segment_ids.map((id) => (
                  <button
                    key={id}
                    type="button"
                    disabled={!segmentById.has(id)}
                    className="text-xs text-primary underline disabled:text-muted-foreground"
                    onClick={() => seekSource(id)}
                  >
                    {t.source}:{" "}
                    {transcriptTime(segmentById.get(id)?.start_ms ?? 0)}
                  </button>
                ))}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  editDraft((current) => ({
                    ...current,
                    action_items: current.action_items.filter(
                      (_, i) => i !== index
                    ),
                  }))
                }
              >
                {t.remove}
              </Button>
            </div>
          ))}
          {!draft.action_items.length && (
            <p className="rounded-xl border p-5 text-sm text-muted-foreground">
              {t.noItems}
            </p>
          )}
          <Button
            variant="outline"
            onClick={() =>
              editDraft((current) => ({
                ...current,
                action_items: [
                  ...current.action_items,
                  {
                    id: crypto.randomUUID(),
                    result_version_id: current.result_version_id,
                    text: "",
                    assignee_participant_id: null,
                    assignee_text: null,
                    due_text: null,
                    due_date: null,
                    status: "open",
                    source_segment_ids: [],
                  },
                ],
              }))
            }
          >
            {t.addAction}
          </Button>
        </section>
      )}
      </fieldset>
    </section>
  );
}
