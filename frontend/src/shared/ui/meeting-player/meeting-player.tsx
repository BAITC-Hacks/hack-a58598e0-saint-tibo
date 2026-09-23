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
} from "./types";

type Props = {
  source: MediaSource;
  ref?: Ref<MeetingPlayerHandle>;
  onPositionChange?: (position: PlaybackPosition) => void;
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

function PlayerSession({ source, ref, onPositionChange }: Props) {
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
      className="space-y-4 rounded-lg border bg-card p-4 sm:p-6"
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
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="min-w-0 font-medium break-words">{source.title}</h2>
        <output className="text-sm text-muted-foreground">
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
      <div className="space-y-2">
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
        <p className="text-sm text-muted-foreground tabular-nums">
          {timeLabel(position)} /{" "}
          {duration === null ? "—" : timeLabel(duration)}
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
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
            size="icon"
            disabled={status === "error"}
            aria-label={
              playing
                ? m.player_pause({}, { locale })
                : m.player_play({}, { locale })
            }
            onClick={toggle}
          >
            {playing ? (
              <Pause aria-hidden="true" />
            ) : (
              <Play aria-hidden="true" />
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            disabled={status === "error"}
            aria-label={m.player_forward({}, { locale })}
            onClick={() =>
              seek(((audioRef.current?.currentTime ?? 0) + 10) * 1000)
            }
          >
            <RotateCw aria-hidden="true" />
          </Button>
        </div>
        <div className="grid gap-1">
          <label
            htmlFor={`${id}-rate`}
            className="text-xs text-muted-foreground"
          >
            {m.player_rate({}, { locale })}
          </label>
          <select
            id={`${id}-rate`}
            value={rate}
            className="min-h-9 rounded-md border bg-background px-2 text-sm"
            onChange={(event) => {
              const next = Number(event.target.value);
              setRate(next);
              if (audioRef.current) audioRef.current.playbackRate = next;
            }}
          >
            {rates.map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </select>
        </div>
        <div className="grid min-w-24 flex-1 gap-1 sm:max-w-40">
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
