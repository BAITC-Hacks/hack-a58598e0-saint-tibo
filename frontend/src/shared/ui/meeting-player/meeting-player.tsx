import { Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import type { Ref } from "react";

import { m } from "#/shared/lib/i18n/messages";
import { useLocale } from "#/shared/lib/locales";
import { Button } from "#/shared/ui/shadcn/button";

import type {
  MediaSource,
  MeetingPlayerHandle,
  PlaybackPosition,
  PlaybackStatus,
  TimelineMarker,
} from "./types";

type Props = {
  source: MediaSource;
  ref?: Ref<MeetingPlayerHandle>;
  onPositionChange?: (position: PlaybackPosition) => void;
  /** Markers must come from real timestamped source material. */
  markers?: readonly TimelineMarker[];
  /** Peaks are decoded in the browser from the user's local file. */
  waveform?: readonly number[] | null;
};

const rates = [0.5, 0.75, 1, 1.25, 1.5, 2];

function timeLabel(seconds: number) {
  const total = Math.floor(Math.max(0, seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = String(total % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${remaining}`
    : `${minutes}:${remaining}`;
}

/** A new source gets its own session: old audio and pending play promises cannot leak. */
export function MeetingPlayer(props: Props) {
  return (
    <PlayerSession key={`${props.source.id}:${props.source.url}`} {...props} />
  );
}

function PlayerSession({
  source,
  ref,
  onPositionChange,
  markers = [],
  waveform,
}: Props) {
  const locale = useLocale();
  const id = useId();
  const audioRef = useRef<HTMLAudioElement>(null);
  const disposed = useRef(false);
  const pendingSeek = useRef<number | null>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const [status, setStatus] = useState<PlaybackStatus>("loading");
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [playBlocked, setPlayBlocked] = useState(false);

  const reportPosition = () => {
    const audio = audioRef.current;
    if (!audio || disposed.current) return;
    const length =
      Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : null;
    const current = Number.isFinite(audio.currentTime)
      ? Math.max(0, audio.currentTime)
      : 0;
    setPosition(current);
    setDuration(length);
    onPositionChange?.({
      sourceId: source.id,
      positionMs: Math.round(current * 1000),
      durationMs: length === null ? null : Math.round(length * 1000),
    });
  };

  const seek = (timeMs: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(timeMs)) return;
    const requested = Math.max(0, timeMs / 1000);
    if (audio.readyState === 0) {
      pendingSeek.current = requested;
      return;
    }
    audio.currentTime = Number.isFinite(audio.duration)
      ? Math.min(requested, audio.duration)
      : requested;
    reportPosition();
  };

  useImperativeHandle(ref, () => ({
    seek,
    pause: () => audioRef.current?.pause(),
  }));

  useEffect(() => {
    disposed.current = false;
    const audio = audioRef.current;
    // Restore the source after the development StrictMode cleanup/setup cycle.
    if (audio) audio.src = source.url;
    return () => {
      disposed.current = true;
      if (!audio) return;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    };
  }, [source.url]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    setPlayBlocked(false);
    if (audio.ended) audio.currentTime = 0;
    void audio.play().catch((error: unknown) => {
      if (
        disposed.current ||
        (error instanceof DOMException && error.name === "AbortError")
      )
        return;
      setPlaying(false);
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setPlayBlocked(true);
        setStatus("paused");
      } else {
        setStatus("error");
      }
    });
  };

  const statusLabels = {
    loading: m.player_loading,
    ready: m.player_ready,
    playing: m.player_playing,
    paused: m.player_paused,
    buffering: m.player_buffering,
    ended: m.player_ended,
    error: m.player_error,
  };

  return (
    <section
      aria-label={m.player_label({}, { locale })}
      className="space-y-5 rounded-2xl border bg-card p-4 shadow-sm sm:p-6"
    >
      {/* The transcript is supplied alongside this audio-only component by the meeting page. */}
      {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- audio transcript is rendered by the consuming page */}
      <audio
        ref={audioRef}
        preload="metadata"
        onLoadedMetadata={() => {
          if (audioRef.current) {
            audioRef.current.playbackRate = rate;
            audioRef.current.volume = volume;
          }
          if (pendingSeek.current !== null) {
            seek(pendingSeek.current * 1000);
            pendingSeek.current = null;
          }
          reportPosition();
          setStatus("ready");
        }}
        onDurationChange={reportPosition}
        onTimeUpdate={reportPosition}
        onLoadStart={() => setStatus("loading")}
        onPlaying={() => {
          setPlaying(true);
          setStatus("playing");
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => {
          setPlaying(false);
          setStatus((previous) => (previous === "error" ? previous : "paused"));
        }}
        onWaiting={() => setStatus("buffering")}
        onSeeking={() => setStatus("buffering")}
        onSeeked={() => {
          reportPosition();
          setStatus(audioRef.current?.paused ? "paused" : "playing");
        }}
        onCanPlay={() =>
          setStatus((previous) =>
            previous === "loading" || previous === "buffering"
              ? audioRef.current?.paused
                ? "ready"
                : "playing"
              : previous
          )
        }
        onEnded={() => {
          setPlaying(false);
          setStatus("ended");
          reportPosition();
        }}
        onError={() => {
          setPlaying(false);
          setStatus("error");
        }}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="min-w-0 text-lg font-semibold break-words">
          {source.title}
        </h2>
        <output className="rounded-full border px-3 py-1 text-xs text-muted-foreground">
          {statusLabels[status]({}, { locale })}
        </output>
      </div>
      {status === "error" && (
        <div role="alert" className="space-y-2 text-sm text-destructive">
          <p>{m.player_error_help({}, { locale })}</p>
          <Button
            variant="outline"
            onClick={() => {
              setPlayBlocked(false);
              setStatus("loading");
              audioRef.current?.load();
            }}
          >
            {m.player_retry({}, { locale })}
          </Button>
        </div>
      )}
      {playBlocked && (
        <p role="alert" className="text-sm">
          {m.player_play_blocked({}, { locale })}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="icon"
          className="size-12 rounded-full"
          disabled={status === "error"}
          aria-label={
            playing
              ? m.player_pause({}, { locale })
              : m.player_play({}, { locale })
          }
          onClick={toggle}
        >
          {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={status === "error"}
          aria-label={m.player_back({}, { locale })}
          onClick={() =>
            seek(((audioRef.current?.currentTime ?? 0) - 10) * 1000)
          }
        >
          <RotateCcw aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={status === "error"}
          aria-label={m.player_forward({}, { locale })}
          onClick={() =>
            seek(((audioRef.current?.currentTime ?? 0) + 10) * 1000)
          }
        >
          <RotateCw aria-hidden="true" />
        </Button>
        <span className="font-mono text-sm font-semibold tabular-nums">
          {timeLabel(position)}{" "}
          <span className="text-muted-foreground">
            / {duration === null ? "—" : timeLabel(duration)}
          </span>
        </span>
        <fieldset
          className="ms-auto flex flex-wrap gap-1 rounded-full border p-1"
          aria-label={m.player_rate({}, { locale })}
        >
          {rates.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={rate === value}
              onClick={() => {
                setRate(value);
                if (audioRef.current) audioRef.current.playbackRate = value;
              }}
              className="min-h-8 rounded-full px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring aria-pressed:bg-primary aria-pressed:text-primary-foreground"
            >
              {value}×
            </button>
          ))}
        </fieldset>
      </div>
      <div className="space-y-3">
        {waveform && waveform.length > 0 && (
          <div
            className="flex h-16 items-center gap-px overflow-hidden rounded-md bg-muted/50 px-1"
            aria-hidden="true"
          >
            {waveform.map((peak, index) => (
              <span
                key={index}
                className="min-w-0 flex-1 rounded-full bg-primary/55"
                style={{ height: `${Math.max(7, peak * 100)}%` }}
              />
            ))}
          </div>
        )}
        <label htmlFor={`${id}-position`} className="sr-only">
          {m.player_position({}, { locale })}
        </label>
        <input
          id={`${id}-position`}
          type="range"
          min={0}
          max={duration ?? 0}
          step={0.1}
          value={duration === null ? 0 : Math.min(position, duration)}
          disabled={duration === null || status === "error"}
          aria-valuetext={`${timeLabel(position)} / ${duration === null ? "—" : timeLabel(duration)}`}
          onChange={(event) => seek(Number(event.target.value) * 1000)}
          className="h-6 w-full accent-primary"
        />
        {markers.length > 0 && duration !== null && (
          <fieldset
            className="flex w-full min-w-0 gap-px overflow-hidden rounded-md border"
            aria-label={m.player_position({}, { locale })}
          >
            {markers.map((marker, index) => (
              <button
                key={marker.id}
                type="button"
                onClick={() => seek(marker.startMs)}
                style={{
                  flex: `${Math.max(
                    1,
                    (markers[index + 1]?.startMs ?? duration * 1000) -
                      marker.startMs
                  )} 1 0%`,
                }}
                className="min-w-0 flex-1 border-e border-border bg-muted/60 px-2 py-2 text-start text-xs last:border-e-0 hover:bg-accent focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-ring"
                aria-label={`${timeLabel(marker.startMs / 1000)} · ${marker.label}`}
                title={marker.label}
              >
                <span className="block font-mono text-[10px] text-muted-foreground">
                  {timeLabel(marker.startMs / 1000)}
                </span>
                <span className="block truncate">{marker.label}</span>
              </button>
            ))}
          </fieldset>
        )}
      </div>
      <div className="flex justify-end">
        <div className="grid w-40 gap-1">
          <label
            htmlFor={`${id}-volume`}
            className="text-xs text-muted-foreground"
          >
            {m.player_volume({}, { locale })} · {Math.round(volume * 100)}%
          </label>
          <input
            id={`${id}-volume`}
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            className="h-9 w-full accent-primary"
            onChange={(event) => {
              const next = Number(event.target.value);
              setVolume(next);
              if (audioRef.current) audioRef.current.volume = next;
            }}
          />
        </div>
      </div>
    </section>
  );
}
