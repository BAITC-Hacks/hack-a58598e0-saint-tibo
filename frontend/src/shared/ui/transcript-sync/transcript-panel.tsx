import { useEffect, useId, useRef } from "react";

import { m } from "#/shared/lib/i18n/messages";
import { useLocale } from "#/shared/lib/locales";
import { Button } from "#/shared/ui/shadcn/button";

import type { TranscriptSync } from "./use-transcript-sync";

const scrollKeys = new Set([
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  " ",
]);

export function transcriptTime(timeMs: number) {
  const seconds = Math.floor(timeMs / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Optional read-only view; an editor can consume the hook without this component. */
export function TranscriptPanel({
  sync,
  speakerFilter = "",
  speakers = [],
  canonicalSpeaker = (id: string) => id,
}: {
  sync: TranscriptSync;
  speakerFilter?: string;
  speakers?: readonly { id: string; label: string; color: string }[];
  canonicalSpeaker?: (id: string) => string;
}) {
  const locale = useLocale();
  const id = useId();
  const viewport = useRef<HTMLElement>(null);
  const rows = useRef(new Map<string, HTMLButtonElement>());
  const expectedScroll = useRef(0);
  const previousReveal = useRef(0);
  const { activeSegmentId, follow, reveal, setFollow } = sync;

  useEffect(() => {
    const explicit = reveal.sequence !== previousReveal.current;
    previousReveal.current = reveal.sequence;
    const targetId = explicit
      ? reveal.segmentId
      : follow
        ? activeSegmentId
        : null;
    const container = viewport.current;
    const row = targetId ? rows.current.get(targetId) : null;
    if (!row || !container) return;
    if (explicit) row.focus({ preventScroll: true });
    const outer = container.getBoundingClientRect();
    const inner = row.getBoundingClientRect();
    if (inner.top < outer.top || inner.bottom > outer.bottom) {
      // Scroll only this viewport, without animation or moving the whole meeting page.
      container.scrollTop +=
        inner.top - outer.top - container.clientHeight / 2 + inner.height / 2;
    }
    expectedScroll.current = container.scrollTop;
  }, [activeSegmentId, follow, reveal]);

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${id}-title`} className="font-medium">
          {m.transcript_title({}, { locale })}
        </h2>
        <Button
          variant="outline"
          aria-pressed={follow}
          onClick={() => setFollow(!follow)}
        >
          {m.transcript_follow({}, { locale })}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {follow
          ? m.transcript_follow_on({}, { locale })
          : m.transcript_follow_off({}, { locale })}
      </p>
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- scroll region handles user scroll intent without changing native semantics */}
      <section
        ref={viewport}
        aria-labelledby={`${id}-title`}
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- keyboard users must be able to scroll this bounded region
        tabIndex={0}
        className="h-64 overflow-y-auto overscroll-contain rounded-md border p-2 focus-visible:outline-2 focus-visible:outline-ring"
        onWheel={() => setFollow(false)}
        onTouchMove={() => setFollow(false)}
        onKeyDown={(event) => {
          if (scrollKeys.has(event.key)) setFollow(false);
        }}
        onPointerDown={(event) => {
          // Native scrollbar drags target the viewport itself.
          if (event.target === event.currentTarget) setFollow(false);
        }}
        onScroll={(event) => {
          const top = event.currentTarget.scrollTop;
          if (Math.abs(top - expectedScroll.current) > 1) setFollow(false);
          expectedScroll.current = top;
        }}
      >
        {sync.segments.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">
            {m.transcript_empty({}, { locale })}
          </p>
        ) : (
          <ol className="space-y-2">
            {sync.segments
              .filter(
                (segment) =>
                  !speakerFilter ||
                  (segment.speaker_id &&
                    canonicalSpeaker(segment.speaker_id) === speakerFilter)
              )
              .map((segment) => {
                const speaker = segment.speaker_id
                  ? speakers.find(
                      (row) => row.id === canonicalSpeaker(segment.speaker_id!)
                    )
                  : null;
                return (
                  <li key={segment.id}>
                    <button
                      ref={(element) => {
                        if (element) rows.current.set(segment.id, element);
                        else rows.current.delete(segment.id);
                      }}
                      type="button"
                      aria-current={
                        activeSegmentId === segment.id ? "true" : undefined
                      }
                      onClick={() => sync.seekSegment(segment.id)}
                      className="w-full rounded-md border border-transparent p-3 text-start focus-visible:outline-2 focus-visible:outline-ring aria-current:border-primary aria-current:bg-accent"
                    >
                      <span className="block text-xs text-muted-foreground tabular-nums">
                        {transcriptTime(segment.start_ms)}–
                        {transcriptTime(segment.end_ms)}
                      </span>
                      {speaker && (
                        <span className="mb-1 block text-xs font-semibold">
                          <span
                            className="me-1 inline-block size-2 rounded-full"
                            style={{ backgroundColor: speaker.color }}
                            aria-hidden="true"
                          />
                          {speaker.label}
                        </span>
                      )}
                      <span className="block text-sm">{segment.text}</span>
                    </button>
                  </li>
                );
              })}
          </ol>
        )}
      </section>
    </section>
  );
}
