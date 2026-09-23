import { useState } from "react";

import type { PlaybackPosition } from "#/shared/ui/meeting-player";

import type { TranscriptSegment } from "./types";

type Options = {
  recordingId: string;
  resultVersionId: string;
  segments: readonly TranscriptSegment[];
  seek: (positionMs: number) => void;
  playbackPosition?: PlaybackPosition | null;
};

/** Mount with key={`${recordingId}:${resultVersionId}`} to reset a transcript session. */
export function useTranscriptSync({
  recordingId,
  resultVersionId,
  segments,
  seek,
  playbackPosition,
}: Options) {
  const [position, setPosition] = useState<PlaybackPosition | null>(null);
  const [follow, setFollow] = useState(true);
  const [reveal, setReveal] = useState({ segmentId: "", sequence: 0 });
  const orderedSegments = segments
    .filter(
      (segment) =>
        segment.recording_id === recordingId &&
        segment.result_version_id === resultVersionId &&
        Number.isInteger(segment.start_ms) &&
        Number.isInteger(segment.end_ms) &&
        segment.start_ms >= 0 &&
        segment.end_ms > segment.start_ms
    )
    .toSorted((a, b) => a.start_ms - b.start_ms || a.id.localeCompare(b.id));
  const currentPosition =
    playbackPosition === undefined ? position : playbackPosition;
  const positionMs =
    currentPosition?.sourceId === recordingId
      ? currentPosition.positionMs
      : null;
  // Half-open intervals: silence clears the highlight; latest start wins overlaps.
  const activeSegmentId =
    positionMs === null
      ? null
      : (orderedSegments.findLast(
          (segment) =>
            segment.start_ms <= positionMs && positionMs < segment.end_ms
        )?.id ?? null);

  const seekSegment = (segmentId: string) => {
    const segment = orderedSegments.find((item) => item.id === segmentId);
    if (!segment) return false;
    seek(segment.start_ms);
    setReveal((previous) => ({ segmentId, sequence: previous.sequence + 1 }));
    return true;
  };

  return {
    segments: orderedSegments,
    activeSegmentId,
    follow,
    setFollow,
    reveal,
    seekSegment,
    onPositionChange: (next: PlaybackPosition) => {
      if (next.sourceId === recordingId && Number.isFinite(next.positionMs)) {
        setPosition(next);
      }
    },
  };
}

export type TranscriptSync = ReturnType<typeof useTranscriptSync>;
