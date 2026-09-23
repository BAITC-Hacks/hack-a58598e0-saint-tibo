import { useEffect, useRef, useState } from "react";

import { createCaptureTarget, saveCapture } from "#/shared/api/capture-upload";
import type { CaptureTarget } from "#/shared/api/capture-upload";
import type { RecordingRead } from "#/shared/api/generated";
import { AudioCapture, initialCaptureState } from "#/shared/lib/audio-capture";
import type { CaptureIssue, CaptureSource } from "#/shared/lib/audio-capture";
import { m } from "#/shared/lib/i18n/messages";
import { useLocale } from "#/shared/lib/locales";
import { MeetingPlayer } from "#/shared/ui/meeting-player";
import { Button } from "#/shared/ui/shadcn/button";

export const MeetingCapture = () => {
  const locale = useLocale();
  const [state, setState] = useState(initialCaptureState);
  const [source, setSource] = useState<CaptureSource>("microphone");
  const [notified, setNotified] = useState(false);
  const [url, setUrl] = useState<string>();
  const [playbackError, setPlaybackError] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState<RecordingRead>();
  const [targetCreated, setTargetCreated] = useState(false);
  const objectUrl = useRef<string | undefined>(undefined);
  const capture = useRef<AudioCapture | null>(null);
  const target = useRef<CaptureTarget | null>(null);
  const saveAbort = useRef<AbortController | null>(null);
  const busy = ["requesting", "recording", "stopping"].includes(state.phase);
  const t = { locale };
  useEffect(
    () => () => {
      capture.current?.dispose();
      saveAbort.current?.abort();
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    []
  );
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    if (busy || saving || (state.result && !saved))
      window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy, saving, saved, state.result]);
  const issues: Record<CaptureIssue, string> = {
    unsupported: m.capture_error_unsupported({}, t),
    permission: m.capture_error_permission({}, t),
    no_audio: m.capture_error_no_audio({}, t),
    source_lost: m.capture_error_source_lost({}, t),
    limit: m.capture_error_limit({}, t),
    device: m.capture_error_device({}, t),
  };
  const phases = {
    idle: m.capture_idle({}, t),
    requesting: m.capture_requesting({}, t),
    recording: m.capture_recording({}, t),
    stopping: m.capture_stopping({}, t),
    complete: m.capture_complete({}, t),
    incomplete: m.capture_incomplete({}, t),
    error: m.capture_error({}, t),
  };
  const start = () => {
    target.current = null;
    setTargetCreated(false);
    setSaved(undefined);
    setSaveError("");
    capture.current?.dispose();
    capture.current = new AudioCapture((next) => {
      if (next.result) {
        if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
        objectUrl.current = URL.createObjectURL(next.result.blob);
        setUrl(objectUrl.current);
      }
      setState(next);
    });
    setPlaybackError(false);
    void capture.current.start(source);
  };
  const reset = () => {
    saveAbort.current?.abort();
    saveAbort.current = null;
    target.current = null;
    setTargetCreated(false);
    setSaving(false);
    setSaveError("");
    setSaved(undefined);
    capture.current?.dispose();
    capture.current = null;
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = undefined;
    setUrl(undefined);
    setState(initialCaptureState);
    setPlaybackError(false);
  };
  const save = async () => {
    if (!state.result || saving) return;
    const controller = new AbortController();
    saveAbort.current = controller;
    setSaving(true);
    setSaveError("");
    try {
      target.current ??= await createCaptureTarget(
        state.result,
        title.trim() || m.capture_save_default_title({}, t),
        controller.signal
      );
      setTargetCreated(true);
      const recording = await saveCapture(
        state.result,
        target.current,
        controller.signal
      );
      if (!controller.signal.aborted) setSaved(recording);
    } catch (error) {
      if (!controller.signal.aborted)
        setSaveError(
          error instanceof Error && error.message
            ? error.message
            : m.capture_save_error({}, t)
        );
    } finally {
      if (saveAbort.current === controller) {
        saveAbort.current = null;
        setSaving(false);
      }
    }
  };
  const seconds = Math.floor(state.elapsedMs / 1000);
  return (
    <section
      className="max-w-2xl space-y-4"
      aria-label={m.capture_title({}, t)}
    >
      <h1 className="text-xl font-semibold tracking-tight">
        {m.capture_title({}, t)}
      </h1>
      <p className="text-sm text-muted-foreground">
        {m.capture_description({}, t)}
      </p>
      <p className="rounded-lg border p-3 text-sm">
        {m.capture_transport_disconnected({}, t)}
      </p>
      <label className="grid gap-2 text-sm">
        {m.capture_source({}, t)}
        <select
          className="rounded-md border bg-background p-2"
          value={source}
          disabled={busy || Boolean(state.result)}
          onChange={(event) => {
            const value = event.target.value;
            if (
              value === "microphone" ||
              value === "display" ||
              value === "both"
            )
              setSource(value);
          }}
        >
          <option value="microphone">{m.capture_microphone({}, t)}</option>
          <option value="display">{m.capture_display({}, t)}</option>
          <option value="both">{m.capture_both({}, t)}</option>
        </select>
      </label>
      <p className="text-sm text-muted-foreground">
        {m.capture_browser_help({}, t)}
      </p>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={notified}
          disabled={busy}
          onChange={(event) => setNotified(event.target.checked)}
        />
        {m.capture_notice({}, t)}
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!notified || busy || Boolean(state.result)}
          onClick={start}
        >
          {m.capture_start({}, t)}
        </Button>
        <Button
          variant="outline"
          disabled={state.phase !== "recording" && state.phase !== "requesting"}
          onClick={() => {
            if (state.phase === "requesting") reset();
            else capture.current?.stop();
          }}
        >
          {state.phase === "requesting"
            ? m.capture_cancel({}, t)
            : m.capture_stop({}, t)}
        </Button>
        {state.result && (
          <Button variant="outline" disabled={saving} onClick={reset}>
            {m.capture_discard({}, t)}
          </Button>
        )}
      </div>
      <output className="block">{phases[state.phase]}</output>
      <p className="font-mono tabular-nums" aria-label={m.capture_timer({}, t)}>
        {String(Math.floor(seconds / 60)).padStart(2, "0")}:
        {String(seconds % 60).padStart(2, "0")}
      </p>
      <p className="text-sm">
        {m.capture_buffer(
          {
            chunks: state.chunkCount,
            mib: (state.bytes / 1024 / 1024).toFixed(1),
          },
          t
        )}
      </p>
      {state.sources.map((item, index) => (
        <div className="space-y-1" key={`${item.kind}-${index}`}>
          <p className="text-sm break-words">
            {item.kind === "microphone"
              ? m.capture_microphone({}, t)
              : m.capture_display({}, t)}
            : {item.label}
          </p>
          <meter
            className="w-full"
            min={0}
            max={1}
            value={item.level}
            aria-label={m.capture_signal({}, t)}
          />
          {state.phase === "recording" && (item.silent || item.muted) && (
            <output className="block text-sm">
              {m.capture_silence({}, t)}
            </output>
          )}
        </div>
      ))}
      {state.issue && (
        <p role="alert" className="text-sm text-destructive">
          {issues[state.issue]}
        </p>
      )}
      {url && (
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-sm">{m.capture_local_result({}, t)}</p>
          {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- Raw local recording has no transcript; do not fabricate captions. */}
          <audio
            className="w-full"
            controls
            src={url}
            aria-label={m.capture_playback({}, t)}
            onError={() => setPlaybackError(true)}
          />
          {playbackError && (
            <p role="alert">{m.capture_playback_error({}, t)}</p>
          )}
          <a
            className="text-sm underline"
            href={url}
            download={`recording${state.result?.is_complete ? "" : "-incomplete"}.${state.result?.blob.type.includes("mp4") ? "m4a" : state.result?.blob.type.includes("ogg") ? "ogg" : "webm"}`}
          >
            {m.capture_download({}, t)}
          </a>
        </div>
      )}
      {state.result && (
        <div className="space-y-3 rounded-lg border p-3">
          <label className="grid gap-2 text-sm">
            {m.capture_save_title({}, t)}
            <input
              className="rounded-md border bg-background p-2"
              value={title}
              disabled={saving || Boolean(saved) || targetCreated}
              placeholder={m.capture_save_default_title({}, t)}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          {!saved && (
            <Button disabled={saving} onClick={() => void save()}>
              {saving
                ? m.capture_saving({}, t)
                : targetCreated
                  ? m.capture_save_retry({}, t)
                  : m.capture_save({}, t)}
            </Button>
          )}
          {saveError && (
            <p role="alert" className="text-sm text-destructive">
              {saveError}
            </p>
          )}
          {saved && (
            <output className="block text-sm">
              {m.capture_saved({ status: saved.status }, t)}
            </output>
          )}
          {saved?.media_url && (
            <MeetingPlayer
              source={{
                id: saved.id,
                url: saved.media_url,
                title: saved.original_filename,
              }}
            />
          )}
        </div>
      )}
      <p className="text-sm text-muted-foreground">{m.capture_limits({}, t)}</p>
    </section>
  );
};
