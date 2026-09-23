import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  apiErrorMessage,
  backendClient,
  getMeetingCanvas,
  getMeetingCanvasVersion,
  getResultVersion,
  saveMeetingCanvas,
} from "#/shared/api";
import type { CanvasRead, CanvasWrite } from "#/shared/api";
import { useLocale } from "#/shared/lib/locales";
import { Button } from "#/shared/ui/shadcn/button";
import { Textarea } from "#/shared/ui/shadcn/textarea";

type Fields = Omit<CanvasWrite, "base_revision">;
const fields = [
  "purpose",
  "inputs",
  "expected_outputs",
  "facilitation_flow",
  "agenda_structure",
  "participants",
  "expected_artifacts",
] as const;
const empty: Fields = {
  purpose: null,
  inputs: null,
  expected_outputs: null,
  facilitation_flow: null,
  agenda_structure: null,
  participants: null,
  expected_artifacts: null,
};
const fromCanvas = (canvas: CanvasRead | null): Fields =>
  canvas
    ? {
        purpose: canvas.purpose,
        inputs: canvas.inputs,
        expected_outputs: canvas.expected_outputs,
        facilitation_flow: canvas.facilitation_flow,
        agenda_structure: canvas.agenda_structure,
        participants: canvas.participants,
        expected_artifacts: canvas.expected_artifacts,
      }
    : { ...empty };

const copy = {
  ru: {
    title: "Канва встречи",
    version: "Версия",
    save: "Сохранить канву",
    reload: "Загрузить актуальную",
    unknown: "Неизвестно",
    empty: "Пусто",
    conflict: "Канва изменилась в другой вкладке. Ваш текст сохранён здесь.",
    noCanvas: "Канва ещё не создана.",
    noResultCanvas: "Результат создан без канвы.",
    resultCanvas: "Канва, использованная для результата",
    current: "Текущая канва",
    loading: "Загрузка канвы…",
    error: "Не удалось загрузить канву",
    labels: [
      "Цель",
      "Исходные данные",
      "Ожидаемые результаты",
      "Ход фасилитации",
      "Повестка и структура",
      "Участники",
      "Ожидаемые артефакты",
    ],
  },
  kk: {
    title: "Кездесу канвасы",
    version: "Нұсқа",
    save: "Канвасты сақтау",
    reload: "Соңғы нұсқаны жүктеу",
    unknown: "Белгісіз",
    empty: "Бос",
    conflict: "Канвас басқа қойындыда өзгерді. Мәтініңіз осы жерде сақталды.",
    noCanvas: "Канвас әлі жасалмаған.",
    noResultCanvas: "Нәтиже канвассыз жасалған.",
    resultCanvas: "Нәтижеге қолданылған канвас",
    current: "Ағымдағы канвас",
    loading: "Канвас жүктелуде…",
    error: "Канвасты жүктеу мүмкін болмады",
    labels: [
      "Мақсат",
      "Кіріс деректері",
      "Күтілетін нәтижелер",
      "Фасилитация барысы",
      "Күн тәртібі мен құрылымы",
      "Қатысушылар",
      "Күтілетін артефактілер",
    ],
  },
  en: {
    title: "Meeting canvas",
    version: "Version",
    save: "Save canvas",
    reload: "Load current version",
    unknown: "Unknown",
    empty: "Empty",
    conflict: "The canvas changed in another tab. Your text is still here.",
    noCanvas: "No canvas has been created yet.",
    noResultCanvas: "This result has no canvas.",
    resultCanvas: "Canvas used for this result",
    current: "Current canvas",
    loading: "Loading canvas…",
    error: "Could not load canvas",
    labels: [
      "Purpose",
      "Inputs",
      "Expected outputs",
      "Facilitation flow",
      "Agenda and structure",
      "Participants",
      "Expected artifacts",
    ],
  },
};

export function CanvasPanel({
  meetingId,
  result,
}: {
  meetingId: string;
  result?: { recordingId: string; versionId: string };
}) {
  const t = copy[useLocale()];
  const client = useQueryClient();
  const current = useQuery({
    queryKey: ["canvas", meetingId],
    staleTime: Infinity,
    queryFn: async () => {
      const response = await getMeetingCanvas({
        client: backendClient,
        path: { meeting_id: meetingId },
      });
      if (response.data === undefined || response.error)
        throw new Error(apiErrorMessage(response.error, t.error));
      return response.data;
    },
  });
  const version = useQuery({
    queryKey: ["canvas-result", meetingId, result?.versionId],
    enabled: !!result,
    queryFn: async () => {
      const response = await getResultVersion({
        client: backendClient,
        path: {
          meeting_id: meetingId,
          recording_id: result!.recordingId,
          result_version_id: result!.versionId,
        },
      });
      if (!response.data)
        throw new Error(apiErrorMessage(response.error, t.error));
      return response.data;
    },
  });
  const pinnedId = version.data?.canvas_version_id;
  const pinned = useQuery({
    queryKey: ["canvas-version", meetingId, pinnedId],
    enabled: !!pinnedId,
    queryFn: async () => {
      const response = await getMeetingCanvasVersion({
        client: backendClient,
        path: {
          meeting_id: meetingId,
          canvas_id: pinnedId!,
        },
      });
      if (!response.data)
        throw new Error(apiErrorMessage(response.error, t.error));
      return response.data;
    },
  });
  const [draft, setDraft] = useState<{
    fields: Fields;
    baseRevision: number;
  } | null>(null);
  const [conflict, setConflict] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const values = draft?.fields ?? fromCanvas(current.data ?? null);
  const dirty =
    JSON.stringify(values) !== JSON.stringify(fromCanvas(current.data ?? null));
  function change(field: keyof Fields, value: string | null) {
    setDraft((previous) => ({
      fields: {
        ...(previous?.fields ?? fromCanvas(current.data ?? null)),
        [field]: value,
      },
      baseRevision: previous?.baseRevision ?? current.data?.revision ?? 0,
    }));
  }

  async function save() {
    setSaveError("");
    setSaving(true);
    try {
      const response = await saveMeetingCanvas({
        client: backendClient,
        path: { meeting_id: meetingId },
        body: {
          base_revision: draft?.baseRevision ?? current.data?.revision ?? 0,
          ...values,
        },
      });
      if (response.response?.status === 409) {
        setConflict(true);
        return;
      }
      if (!response.data)
        throw new Error(apiErrorMessage(response.error, t.error));
      client.setQueryData(["canvas", meetingId], response.data);
      setDraft(null);
      setConflict(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside
      className="min-w-0 rounded-xl border bg-card p-5"
      aria-label={t.title}
    >
      <h2 className="text-lg font-semibold">{t.title}</h2>
      {current.isPending ? (
        <p>{t.loading}</p>
      ) : current.isError ? (
        <p role="alert">{t.error}</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {t.current} · {t.version} {current.data?.revision ?? 0}
          </p>
          {!current.data && (
            <p className="mt-2 text-sm text-muted-foreground">{t.noCanvas}</p>
          )}
          <div className="mt-4 space-y-4">
            {fields.map((field, index) => (
              <div key={field}>
                <label
                  className="block text-sm font-medium"
                  htmlFor={`canvas-${field}`}
                >
                  {t.labels[index]}
                </label>
                <label className="mt-1 flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={values[field] === null}
                    onChange={(event) =>
                      change(field, event.target.checked ? null : "")
                    }
                  />
                  {t.unknown}
                </label>
                <Textarea
                  id={`canvas-${field}`}
                  className="mt-1"
                  maxLength={5000}
                  disabled={values[field] === null}
                  value={values[field] ?? ""}
                  onChange={(event) => change(field, event.target.value)}
                />
              </div>
            ))}
          </div>
          {conflict && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {t.conflict}
            </p>
          )}
          {saveError && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {saveError}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              disabled={(!dirty && !!current.data) || saving || conflict}
              onClick={() => void save()}
            >
              {t.save}
            </Button>
            {conflict && (
              <Button
                variant="outline"
                onClick={() =>
                  void current.refetch().then((fresh) => {
                    if (fresh.isSuccess) {
                      setDraft(null);
                      setConflict(false);
                    }
                  })
                }
              >
                {t.reload}
              </Button>
            )}
          </div>
        </>
      )}
      {result && (
        <div className="mt-6 border-t pt-4">
          <h3 className="font-medium">{t.resultCanvas}</h3>
          {version.isPending || (pinned.isPending && !!pinnedId) ? (
            <p>{t.loading}</p>
          ) : version.isError || pinned.isError ? (
            <p role="alert">{t.error}</p>
          ) : !pinnedId ? (
            <p className="text-sm text-muted-foreground">{t.noResultCanvas}</p>
          ) : (
            pinned.data && (
              <>
                <p className="text-sm text-muted-foreground">
                  {t.version} {pinned.data.revision}
                </p>
                <dl className="mt-2 space-y-2 text-sm">
                  {fields.map((field, index) => (
                    <div key={field}>
                      <dt className="font-medium">{t.labels[index]}</dt>
                      <dd className="whitespace-pre-wrap">
                        {pinned.data[field] === null
                          ? t.unknown
                          : pinned.data[field] || t.empty}
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            )
          )}
        </div>
      )}
    </aside>
  );
}
