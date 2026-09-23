import type { SpeakerInterval } from "./types";

const colors = [
  "#f59e0b",
  "#ef476f",
  "#17b890",
  "#7289f8",
  "#a855f7",
  "#06b6d4",
  "#f97316",
];

export function speakerColor(index: number) {
  return colors[index % colors.length];
}

/** Combine adjacent turns of the same voice to prevent rapid solo seeks. */
export function mergeSpeakerIntervals(intervals: readonly SpeakerInterval[]) {
  const merged: SpeakerInterval[] = [];
  for (const interval of [...intervals].sort((a, b) => a.startMs - b.startMs)) {
    const previous = merged.at(-1);
    if (
      previous?.speakerId === interval.speakerId &&
      interval.startMs - previous.endMs < 1500
    ) {
      previous.endMs = Math.max(previous.endMs, interval.endMs);
    } else {
      merged.push({ ...interval });
    }
  }
  return merged;
}
