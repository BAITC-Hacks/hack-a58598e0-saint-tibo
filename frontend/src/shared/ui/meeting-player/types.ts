export type MediaSource = {
  id: string;
  /** Browser-playable URL supplied by the authorized media transport, or a local blob URL. */
  url: string;
  title: string;
};

export type TimelineMarker = {
  id: string;
  startMs: number;
  label: string;
};

export type PlaybackStatus =
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "buffering"
  | "ended"
  | "error";

export type PlaybackPosition = {
  sourceId: string;
  positionMs: number;
  durationMs: number | null;
};

export type MeetingPlayerHandle = {
  /** Seek without changing whether playback is paused. Safe before metadata arrives. */
  seek: (timeMs: number) => void;
  pause: () => void;
};
