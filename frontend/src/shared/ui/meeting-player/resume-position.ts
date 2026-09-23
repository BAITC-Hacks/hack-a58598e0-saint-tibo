const KEY = "saint-tibo:player-resume:v1";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 30;

type Entry = { positionMs: number; updatedAt: number };
type Saved = {
  selected?: { meetingId: string; recordingId: string; updatedAt: number };
  positions: Record<string, Entry>;
};

function read(): Saved {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (!parsed || typeof parsed !== "object") return { positions: {} };
    const value = parsed as Partial<Saved>;
    const positions: Record<string, Entry> = {};
    for (const [id, entry] of Object.entries(value.positions ?? {})) {
      if (
        entry &&
        Number.isFinite(entry.positionMs) &&
        entry.positionMs >= 0 &&
        Number.isFinite(entry.updatedAt) &&
        entry.updatedAt <= Date.now() &&
        Date.now() - entry.updatedAt < MAX_AGE_MS
      )
        positions[id] = entry;
    }
    return {
      selected:
        typeof value.selected?.meetingId === "string" &&
        typeof value.selected.recordingId === "string" &&
        Number.isFinite(value.selected.updatedAt) &&
        value.selected.updatedAt <= Date.now() &&
        Date.now() - value.selected.updatedAt < MAX_AGE_MS
          ? value.selected
          : undefined,
      positions,
    };
  } catch {
    return { positions: {} };
  }
}

function write(value: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Playback remains available when storage is disabled or full.
  }
}

export function savedRecording() {
  return read().selected;
}

export function savedPosition(id: string): number {
  return read().positions[id]?.positionMs ?? 0;
}

export function saveSelectedRecording(meetingId: string, recordingId: string) {
  const value = read();
  value.selected = { meetingId, recordingId, updatedAt: Date.now() };
  write(value);
}

export function savePosition(
  meetingId: string,
  id: string,
  positionMs: number,
  durationMs: number | null
) {
  if (!id || !Number.isFinite(positionMs)) return;
  const value = read();
  value.selected = { meetingId, recordingId: id, updatedAt: Date.now() };
  const nearEnd =
    durationMs !== null && durationMs > 0 && positionMs >= durationMs - 5000;
  if (nearEnd) delete value.positions[id];
  else
    value.positions[id] = {
      positionMs: Math.max(0, Math.round(positionMs)),
      updatedAt: Date.now(),
    };
  value.positions = Object.fromEntries(
    Object.entries(value.positions)
      .toSorted((a, b) => b[1].updatedAt - a[1].updatedAt)
      .slice(0, MAX_ENTRIES)
  );
  write(value);
}

export function forgetSelectedRecording() {
  const value = read();
  delete value.selected;
  write(value);
}
