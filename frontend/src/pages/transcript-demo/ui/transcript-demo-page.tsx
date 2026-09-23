import { useEffect, useRef, useState } from "react";

import { m } from "#/shared/lib/i18n/messages";
import { useLocale } from "#/shared/lib/locales";
import LocaleSwitcher from "#/shared/ui/locale-switcher";
import { MeetingPlayer } from "#/shared/ui/meeting-player";
import type { MeetingPlayerHandle } from "#/shared/ui/meeting-player";
import { Button } from "#/shared/ui/shadcn/button";
import {
  TranscriptPanel,
  transcriptTime,
  useTranscriptSync,
} from "#/shared/ui/transcript-sync";

import {
  createSyntheticRecording,
  syntheticIntervals,
} from "../lib/synthetic-recording";

const recordingId = "synthetic-recording";
const resultVersionId = "synthetic-result";
const sourceSegmentIds = [
  "synthetic-segment-3",
  "synthetic-segment-7",
  "unavailable-segment",
];

export function TranscriptDemoPage() {
  const locale = useLocale();
  const player = useRef<MeetingPlayerHandle>(null);
  const [url, setUrl] = useState<string | null>(null);
  const segments = syntheticIntervals.map((segment, index) => ({
    ...segment,
    recording_id: recordingId,
    result_version_id: resultVersionId,
    text: m.transcript_demo_segment(
      { number: index + 1, frequency: segment.frequency },
      { locale }
    ),
  }));
  const sync = useTranscriptSync({
    recordingId,
    resultVersionId,
    segments,
    seek: (positionMs) => player.current?.seek(positionMs),
  });

  useEffect(() => {
    const objectUrl = URL.createObjectURL(createSyntheticRecording());
    // oxlint-disable-next-line react/set-state-in-effect -- publish a browser-owned URL with matching effect cleanup
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, []);

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold">
          {m.transcript_demo_title({}, { locale })}
        </h1>
        <LocaleSwitcher />
      </div>
      <p className="text-sm text-muted-foreground">
        {m.transcript_demo_help({}, { locale })}
      </p>
      {url && (
        <MeetingPlayer
          ref={player}
          source={{
            id: recordingId,
            url,
            title: m.transcript_demo_audio({}, { locale }),
          }}
          onPositionChange={sync.onPositionChange}
        />
      )}
      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">
          {m.transcript_demo_action({}, { locale })}
        </h2>
        <p className="text-sm">
          {m.transcript_demo_action_text({}, { locale })}
        </p>
        <div className="flex flex-wrap gap-2">
          {sourceSegmentIds.map((segmentId) => {
            const segment = sync.segments.find((item) => item.id === segmentId);
            return (
              <Button
                key={segmentId}
                variant="outline"
                disabled={!segment}
                onClick={() => sync.seekSegment(segmentId)}
              >
                {segment
                  ? m.transcript_source(
                      { time: transcriptTime(segment.start_ms) },
                      { locale }
                    )
                  : m.transcript_source_missing({}, { locale })}
              </Button>
            );
          })}
        </div>
      </section>
      <TranscriptPanel sync={sync} />
    </main>
  );
}
