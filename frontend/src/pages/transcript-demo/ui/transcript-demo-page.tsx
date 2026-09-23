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

import meetingOneUrl from "../../../../../input-audio/Совещание №1.mp3?url";
import meetingTwoUrl from "../../../../../input-audio/Совещание №2.mp3?url";
import {
  createSyntheticRecording,
  syntheticIntervals,
} from "../lib/synthetic-recording";

const recordingId = "synthetic-recording";
const resultVersionId = "synthetic-result";
type RecordingChoice = "synthetic" | "meeting-one" | "meeting-two";
const sourceSegmentIds = [
  "synthetic-segment-3",
  "synthetic-segment-7",
  "unavailable-segment",
];

export function TranscriptDemoPage() {
  const locale = useLocale();
  const [choice, setChoice] = useState<RecordingChoice>("synthetic");

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
      <div className="grid gap-2">
        <label htmlFor="demo-recording" className="text-sm font-medium">
          {m.transcript_demo_choose({}, { locale })}
        </label>
        <select
          id="demo-recording"
          value={choice}
          className="min-h-9 rounded-md border bg-background px-2 text-sm"
          onChange={(event) => {
            const value = event.target.value;
            if (
              value === "synthetic" ||
              value === "meeting-one" ||
              value === "meeting-two"
            ) {
              setChoice(value);
            }
          }}
        >
          <option value="synthetic">
            {m.transcript_demo_synthetic({}, { locale })}
          </option>
          <option value="meeting-one">
            {m.transcript_demo_meeting_one({}, { locale })}
          </option>
          <option value="meeting-two">
            {m.transcript_demo_meeting_two({}, { locale })}
          </option>
        </select>
      </div>
      {choice === "synthetic" ? (
        <SyntheticSession />
      ) : (
        <>
          <MeetingPlayer
            source={{
              id: choice,
              url: choice === "meeting-one" ? meetingOneUrl : meetingTwoUrl,
              title:
                choice === "meeting-one"
                  ? m.transcript_demo_meeting_one({}, { locale })
                  : m.transcript_demo_meeting_two({}, { locale }),
            }}
          />
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            {m.transcript_demo_no_transcript({}, { locale })}
          </p>
        </>
      )}
    </main>
  );
}

function SyntheticSession() {
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
    <div className="space-y-5">
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
    </div>
  );
}
