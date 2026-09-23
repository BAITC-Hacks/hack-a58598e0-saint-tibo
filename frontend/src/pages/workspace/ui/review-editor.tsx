import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

import {
  backendClient,
  exportReviewedResult,
  listParticipantsOptions,
  updateResultReview,
} from "#/shared/api";
import type {
  ActionItemStatus,
  ReviewRead,
  ReviewUpdate,
  SegmentRead,
} from "#/shared/api";
import { Button } from "#/shared/ui/shadcn/button";
import { Input } from "#/shared/ui/shadcn/input";
import { Textarea } from "#/shared/ui/shadcn/textarea";
import { transcriptTime } from "#/shared/ui/transcript-sync";

import {
  errorKey,
  lines,
  sectionClass,
  selectClass,
  useWorkspaceText,
} from "../lib/workspace";

type Path = {
  meeting_id: string;
  recording_id: string;
  result_version_id: string;
};
type ActionForm = {
  id: string;
  text: string;
  assignee: string;
  assigneeText: string;
  dueText: string;
  dueDate: string;
  status: ActionItemStatus;
  sourceIds: string[];
};
type ReviewForm = {
  topics: string;
  decisions: string;
  questions: string;
  sourceIds: string[];
  actions: ActionForm[];
};
const statuses: ActionItemStatus[] = [
  "open",
  "in_progress",
  "done",
  "cancelled",
];
const emptyAction = (): ActionForm => ({
  id: crypto.randomUUID(),
  text: "",
  assignee: "",
  assigneeText: "",
  dueText: "",
  dueDate: "",
  status: "open",
  sourceIds: [],
});

function SourcePicker({
  value,
  onChange,
  segments,
  onSeek,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  segments: SegmentRead[];
  onSeek: (id: string) => void;
}) {
  const t = useWorkspaceText();
  const visibleIds = new Set(segments.map((segment) => segment.id));
  return (
    <details className="rounded-md border p-3 text-sm">
      <summary className="cursor-pointer font-medium">
        {t("workspace_sources")} · {value.length}
      </summary>
      <p className="my-2 text-muted-foreground">
        {t("workspace_sources_help")}
      </p>
      <div className="max-h-40 space-y-2 overflow-y-auto">
        {segments.map((segment) => (
          <div className="flex items-start gap-2" key={segment.id}>
            <label className="flex min-w-0 flex-1 items-start gap-2">
              <input
                type="checkbox"
                checked={value.includes(segment.id)}
                disabled={value.length >= 100 && !value.includes(segment.id)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...value, segment.id]
                      : value.filter((id) => id !== segment.id)
                  )
                }
              />
              <span className="line-clamp-2">{segment.text}</span>
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onSeek(segment.id)}
            >
              {transcriptTime(segment.start_ms)}
            </Button>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {t("workspace_source_list_limit")}
      </p>
      {value.some((id) => !visibleIds.has(id)) && (
        <p className="text-xs text-muted-foreground">
          {t("workspace_sources")} ·{" "}
          {value.filter((id) => !visibleIds.has(id)).length} —{" "}
          {t("workspace_source_list_limit")}
        </p>
      )}
    </details>
  );
}

export function ReviewEditor({
  initial,
  path,
  segments,
  onReload,
  onSaved,
  onSeek,
}: {
  initial: ReviewRead;
  path: Path;
  segments: SegmentRead[];
  onReload: () => Promise<void>;
  onSaved: () => Promise<void>;
  onSeek: (id: string) => void;
}) {
  const t = useWorkspaceText();
  const [approve, setApprove] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [reloadError, setReloadError] = useState<unknown>(null);
  const [exportRevision, setExportRevision] = useState(initial.revision);
  const participants = useQuery(
    listParticipantsOptions({
      client: backendClient,
      path: { meeting_id: path.meeting_id },
      query: { limit: 100 },
    })
  );
  const form = useForm<ReviewForm>({
    defaultValues: {
      topics: (initial.summary.topics ?? []).join("\n"),
      decisions: (initial.summary.decisions ?? []).join("\n"),
      questions: (initial.summary.open_questions ?? []).join("\n"),
      sourceIds: initial.summary.source_segment_ids ?? [],
      actions: initial.action_items.map((item) => ({
        id: item.id ?? crypto.randomUUID(),
        text: item.text,
        assignee: item.assignee_participant_id ?? "",
        assigneeText: item.assignee_text ?? "",
        dueText: item.due_text ?? "",
        dueDate: item.due_date ?? "",
        status: item.status ?? "open",
        sourceIds: item.source_segment_ids ?? [],
      })),
    },
  });
  const fields = useFieldArray({
    control: form.control,
    name: "actions",
    keyName: "formId",
  });
  const watched = useWatch({ control: form.control });
  const save = useMutation({
    mutationFn: async (body: ReviewUpdate) =>
      (
        await updateResultReview({
          client: backendClient,
          path,
          body,
          throwOnError: true,
        })
      ).data,
    onError: () => {},
    onSuccess: async () => {
      await onSaved();
    },
  });
  const download = useMutation({
    mutationFn: async (format: "pdf" | "docx") => {
      const response = await exportReviewedResult({
        client: backendClient,
        path,
        query: { format, revision: exportRevision },
        parseAs: "blob",
        throwOnError: true,
      });
      const blob = response.data;
      if (!(blob instanceof Blob)) throw new Error("Invalid download");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `protocol-${path.result_version_id}-r${exportRevision}.${format}`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    },
    onError: () => {},
  });
  const submit = form.handleSubmit((data) => {
    const summary = {
      topics: lines(data.topics),
      decisions: lines(data.decisions),
      open_questions: lines(data.questions),
      source_segment_ids: data.sourceIds,
    };
    if (
      [summary.topics, summary.decisions, summary.open_questions].some(
        (part) => part.length > 100 || part.some((line) => line.length > 2000)
      )
    ) {
      form.setError("root", { message: t("workspace_invalid") });
      return;
    }
    save.mutate({
      revision: initial.revision,
      reviewed: approve,
      summary,
      action_items: data.actions.map((item) => ({
        id: item.id,
        text: item.text.trim(),
        assignee_participant_id: item.assignee || null,
        assignee_text: item.assigneeText.trim() || null,
        due_text: item.dueText.trim() || null,
        due_date: item.dueDate || null,
        status: item.status,
        source_segment_ids: item.sourceIds,
      })),
    });
  });
  const knownParticipants = participants.data?.items ?? [];
  const error =
    save.error || download.error || reloadError || participants.error;
  return (
    <section className={sectionClass}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{t("workspace_review")}</h2>
        <span className="rounded-full bg-muted px-3 py-1 text-sm">
          {t("workspace_revision")} {initial.revision} ·{" "}
          {t(initial.reviewed ? "workspace_reviewed" : "workspace_draft")}
        </span>
      </div>
      {initial.saved_at && (
        <output className="block text-sm text-muted-foreground">
          {t("workspace_saved")} · {new Date(initial.saved_at).toLocaleString()}
        </output>
      )}
      {initial.is_incomplete && (
        <p className="text-sm font-medium">{t("workspace_incomplete")}</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t(errorKey(error))}
        </p>
      )}
      <form
        onSubmit={(event) => void submit(event)}
        onChange={() => {
          if (approve) setApprove(false);
        }}
        className="space-y-5"
      >
        <fieldset disabled={save.isPending || reloading} className="space-y-5">
          <div className="grid gap-3 lg:grid-cols-3">
            <label className="space-y-2 text-sm">
              <span>{t("workspace_topics")}</span>
              <Textarea rows={5} {...form.register("topics")} />
            </label>
            <label className="space-y-2 text-sm">
              <span>{t("workspace_decisions")}</span>
              <Textarea rows={5} {...form.register("decisions")} />
            </label>
            <label className="space-y-2 text-sm">
              <span>{t("workspace_questions")}</span>
              <Textarea rows={5} {...form.register("questions")} />
            </label>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium">
              {t("workspace_summary_sources")}
            </h3>
            <SourcePicker
              value={watched.sourceIds ?? []}
              onChange={(ids) => {
                form.setValue("sourceIds", ids, { shouldDirty: true });
                setApprove(false);
              }}
              segments={segments}
              onSeek={onSeek}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold">{t("workspace_actions")}</h3>
            <Button
              type="button"
              variant="outline"
              disabled={fields.fields.length >= 200}
              onClick={() => {
                fields.append(emptyAction());
                setApprove(false);
              }}
            >
              {t("workspace_add_action")}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("workspace_due_help")}
          </p>
          {fields.fields.map((field, index) => (
            <fieldset
              key={field.formId}
              className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2"
            >
              <legend className="px-2 text-sm font-medium">
                {t("workspace_actions")} {index + 1}
              </legend>
              <label className="space-y-1 text-sm sm:col-span-2">
                <span>{t("workspace_action_text")}</span>
                <Textarea
                  required
                  maxLength={2000}
                  {...form.register(`actions.${index}.text`, {
                    required: true,
                    validate: (text) => !!text.trim(),
                  })}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span>{t("workspace_assignee")}</span>
                <select
                  className={selectClass}
                  {...form.register(`actions.${index}.assignee`)}
                >
                  <option value="">{t("workspace_unknown")}</option>
                  {knownParticipants.map((participant) => (
                    <option key={participant.id} value={participant.id}>
                      {participant.display_name}
                    </option>
                  ))}
                  {!!watched.actions?.[index]?.assignee &&
                    !knownParticipants.some(
                      (p) => p.id === watched.actions?.[index]?.assignee
                    ) && (
                      <option value={watched.actions[index].assignee}>
                        {t("workspace_no_access")}
                      </option>
                    )}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span>{t("workspace_assignee_text")}</span>
                <Input
                  maxLength={500}
                  {...form.register(`actions.${index}.assigneeText`)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span>{t("workspace_due_text")}</span>
                <Input
                  maxLength={500}
                  {...form.register(`actions.${index}.dueText`)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span>{t("workspace_due_date")}</span>
                <Input
                  type="date"
                  {...form.register(`actions.${index}.dueDate`)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span>{t("workspace_status")}</span>
                <select
                  className={selectClass}
                  {...form.register(`actions.${index}.status`)}
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {t(`workspace_${status}`)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    fields.remove(index);
                    setApprove(false);
                  }}
                >
                  {t("workspace_remove")}
                </Button>
              </div>
              <div className="sm:col-span-2">
                <SourcePicker
                  value={watched.actions?.[index]?.sourceIds ?? []}
                  onChange={(ids) => {
                    form.setValue(`actions.${index}.sourceIds`, ids, {
                      shouldDirty: true,
                    });
                    setApprove(false);
                  }}
                  segments={segments}
                  onSeek={onSeek}
                />
              </div>
            </fieldset>
          ))}
        </fieldset>
        {Object.keys(form.formState.errors).length > 0 && (
          <p role="alert" className="text-sm text-destructive">
            {t("workspace_invalid")}
          </p>
        )}
        <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
          <input
            type="checkbox"
            checked={approve}
            disabled={save.isPending || reloading}
            onChange={(event) => {
              event.stopPropagation();
              setApprove(event.target.checked);
            }}
          />
          {t("workspace_approve")}
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={save.isPending || reloading}>
            {t(
              save.isPending
                ? "workspace_saving"
                : approve
                  ? "workspace_save_approved"
                  : "workspace_save"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={save.isPending || reloading}
            onClick={() => {
              setReloading(true);
              setReloadError(null);
              onReload()
                .catch((cause: unknown) => setReloadError(cause))
                .finally(() => setReloading(false));
            }}
          >
            {t("workspace_reload")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("workspace_reload_help")}
        </p>
      </form>
      <div className="space-y-3 border-t pt-5">
        <h3 className="font-semibold">{t("workspace_export")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("workspace_export_help")}
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="max-w-40 space-y-1 text-sm">
            <span>{t("workspace_revision")}</span>
            <Input
              type="number"
              min={2}
              max={initial.revision}
              value={exportRevision}
              onChange={(event) =>
                setExportRevision(event.target.valueAsNumber)
              }
            />
          </label>
          {(["pdf", "docx"] as const).map((format) => (
            <Button
              key={format}
              type="button"
              variant="outline"
              disabled={
                download.isPending ||
                !Number.isInteger(exportRevision) ||
                exportRevision < 2 ||
                exportRevision > initial.revision ||
                (exportRevision === initial.revision && !initial.reviewed)
              }
              onClick={() => download.mutate(format)}
            >
              {format.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>
    </section>
  );
}
