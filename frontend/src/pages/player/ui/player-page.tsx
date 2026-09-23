import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { backendClient, listMeetings, listRecordings } from "#/shared/api";
import { m } from "#/shared/lib/i18n/messages";
import { useLocale } from "#/shared/lib/locales";
import { MeetingPlayer } from "#/shared/ui/meeting-player";
import type {
  MediaSource,
  MeetingPlayerHandle,
  TimelineMarker,
} from "#/shared/ui/meeting-player";
import { Button } from "#/shared/ui/shadcn/button";
import {
  TranscriptPanel,
  transcriptTime,
  useTranscriptSync,
} from "#/shared/ui/transcript-sync";
import type { TranscriptSegment } from "#/shared/ui/transcript-sync";

import { readAudioWaveform } from "../lib/audio-waveform";
import { readLocalTranscript } from "../lib/local-transcript";
import type { LocalTranscriptError } from "../lib/local-transcript";
import {
  allTranscriptSegments,
  latestCompletedResult,
} from "../lib/server-transcript";
import {
  createSyntheticRecording,
  syntheticIntervals,
} from "../lib/synthetic-recording";

/** Local playback lets the media component be exercised before server ingestion lands. */
export const PlayerPage = () => {
  const locale = useLocale();
  const [source, setSource] = useState<MediaSource | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState<{
    name: string;
    segments: TranscriptSegment[];
  } | null>(null);
  const [transcriptError, setTranscriptError] =
    useState<LocalTranscriptError | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [waveform, setWaveform] = useState<number[] | null>(null);
  const [isSample, setIsSample] = useState(false);
  const [selectedServerRecording, setSelectedServerRecording] = useState("");
  const ownedUrl = useRef<string | null>(null);
  const player = useRef<MeetingPlayerHandle>(null);
  const input = useRef<HTMLInputElement>(null);
  const transcriptInput = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const sampleLines = [
    m.player_sample_line_1,
    m.player_sample_line_2,
    m.player_sample_line_3,
    m.player_sample_line_4,
    m.player_sample_line_5,
    m.player_sample_line_6,
    m.player_sample_line_7,
    m.player_sample_line_8,
  ];
  const displayedTranscript =
    isSample && transcript
      ? {
          name: m.player_sample_transcript({}, { locale }),
          segments: transcript.segments.map((segment, index) => ({
            ...segment,
            text: `${
              index % 2 === 0
                ? m.player_sample_speaker_a({}, { locale })
                : m.player_sample_speaker_b({}, { locale })
            }: ${sampleLines[index]?.({}, { locale }) ?? ""}`,
          })),
        }
      : transcript;

  const meetingsQuery = useQuery({
    queryKey: ["player", "meetings"],
    queryFn: async ({ signal }) => {
      const response = await listMeetings({
        client: backendClient,
        query: { limit: 100, offset: 0 },
        signal,
        throwOnError: true,
      });
      return response.data.items;
    },
  });
  const recordingsQuery = useQuery({
    queryKey: [
      "player",
      "recordings",
      meetingsQuery.data?.map((meeting) => meeting.id),
    ],
    enabled: meetingsQuery.isSuccess,
    queryFn: async ({ signal }) => {
      const pages = await Promise.all(
        (meetingsQuery.data ?? []).map(async (meeting) => {
          const response = await listRecordings({
            client: backendClient,
            path: { meeting_id: meeting.id },
            query: { limit: 100, offset: 0 },
            signal,
            throwOnError: true,
          });
          return response.data.items.map((recording) => ({
            ...recording,
            meetingTitle: meeting.title,
          }));
        })
      );
      return pages.flat();
    },
  });

  const serverRecordings = (recordingsQuery.data ?? []).filter(
    (recording) => recording.media_url && recording.media_content_type
  );
  const selectedServerSource = serverRecordings.find(
    (recording) => recording.id === selectedServerRecording
  );
  const selectedServerMedia = selectedServerSource?.media_url
    ? {
        id: selectedServerSource.id,
        url: selectedServerSource.media_url,
        title: `${selectedServerSource.meetingTitle} — ${selectedServerSource.original_filename}`,
      }
    : null;
  const resultVersionQuery = useQuery({
    queryKey: [
      "player",
      "result-version",
      selectedServerSource?.meeting_id,
      selectedServerRecording,
    ],
    enabled: Boolean(selectedServerSource),
    queryFn: ({ signal }) =>
      selectedServerSource
        ? latestCompletedResult(
            {
              meeting_id: selectedServerSource.meeting_id,
              recording_id: selectedServerSource.id,
            },
            signal
          )
        : null,
  });
  const segmentsQuery = useQuery({
    queryKey: [
      "player",
      "segments",
      selectedServerSource?.meeting_id,
      selectedServerRecording,
      resultVersionQuery.data?.id,
    ],
    enabled: Boolean(selectedServerSource && resultVersionQuery.data),
    queryFn: ({ signal }) =>
      selectedServerSource && resultVersionQuery.data
        ? allTranscriptSegments(
            {
              meeting_id: selectedServerSource.meeting_id,
              recording_id: selectedServerSource.id,
              result_version_id: resultVersionQuery.data.id,
            },
            signal
          )
        : [],
  });
  const activeSegments = selectedServerMedia
    ? (segmentsQuery.data ?? [])
    : (displayedTranscript?.segments ?? []);
  const sync = useTranscriptSync({
    recordingId: selectedServerMedia?.id ?? source?.id ?? "",
    resultVersionId: selectedServerMedia
      ? (resultVersionQuery.data?.id ?? "")
      : "local-stt",
    segments: activeSegments,
    seek: (positionMs) => player.current?.seek(positionMs),
  });
  const markers: TimelineMarker[] = activeSegments.length
    ? activeSegments

        .filter(
          (_, index) =>
            index % Math.max(1, Math.ceil(activeSegments.length / 8)) === 0
        )
        .slice(0, 8)
        .map((segment) => ({
          id: segment.id,
          startMs: segment.start_ms,
          label: segment.text,
        }))
    : [];

  useEffect(
    () => () => {
      if (ownedUrl.current) URL.revokeObjectURL(ownedUrl.current);
    },
    []
  );

  const replaceFile = (file: File | null) => {
    generation.current++;
    const currentGeneration = generation.current;
    player.current?.pause();
    if (ownedUrl.current) URL.revokeObjectURL(ownedUrl.current);
    const url = file ? URL.createObjectURL(file) : null;
    ownedUrl.current = url;
    setSourceFile(file);
    setSelectedServerRecording("");
    setSource(file && url ? { id: url, url, title: file.name } : null);
    setTranscript(null);
    setTranscriptError(null);
    setTranscriptLoading(false);
    setWaveform(null);
    setIsSample(false);
    if (transcriptInput.current) transcriptInput.current.value = "";
    if (file) {
      void readAudioWaveform(file).then((peaks) => {
        if (generation.current === currentGeneration) setWaveform(peaks);
      });
    }
    return url;
  };

  const loadSample = () => {
    const file = new File(
      [createSyntheticRecording()],
      "synthetic-meeting.wav",
      {
        type: "audio/wav",
      }
    );
    const url = replaceFile(file);
    if (!url) return;
    setIsSample(true);
    if (input.current) input.current.value = "";
    setTranscript({
      name: m.player_sample_transcript({}, { locale }),
      segments: syntheticIntervals.map((segment) => ({
        id: segment.id,
        recording_id: url,
        result_version_id: "local-stt",
        start_ms: segment.start_ms,
        end_ms: segment.end_ms,
        text: "",
      })),
    });
  };

  const importTranscript = async (file: File | null) => {
    if (!file || !source || !sourceFile) return;
    const currentGeneration = generation.current;
    setTranscriptLoading(true);
    setTranscriptError(null);
    try {
      const segments = await readLocalTranscript(file, sourceFile, source.id);
      if (currentGeneration === generation.current) {
        setIsSample(false);
        setTranscript({ name: file.name, segments });
      }
    } catch (error) {
      if (currentGeneration === generation.current) {
        setTranscript(null);
        const reason = error instanceof Error ? error.message : "invalid";
        setTranscriptError(
          reason === "mismatch" || reason === "too_large" ? reason : "invalid"
        );
      }
    } finally {
      if (currentGeneration === generation.current) setTranscriptLoading(false);
      if (transcriptInput.current) transcriptInput.current.value = "";
    }
  };

  const transcriptErrors = {
    invalid: m.player_transcript_invalid({}, { locale }),
    mismatch: m.player_transcript_mismatch({}, { locale }),
    too_large: m.player_transcript_too_large({}, { locale }),
  };

  return (
    <section className="mx-auto max-w-7xl space-y-7">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {m.player_page({}, { locale })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {m.player_local_help({}, { locale })}
        </p>
      </div>
      <div className="space-y-3 rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="font-medium">
              {m.player_sample_title({}, { locale })}
            </h2>
            <p className="text-sm text-muted-foreground">
              {m.player_sample_help({}, { locale })}
            </p>
          </div>
          <Button onClick={loadSample}>
            {m.player_sample_load({}, { locale })}
          </Button>
        </div>
      </div>
      <div className="grid gap-5 rounded-2xl border bg-card p-5 lg:grid-cols-2">
        <div className="space-y-2">
          <label
            htmlFor="server-recording"
            className="block text-sm font-medium"
          >
            {m.player_server_recordings({}, { locale })}
          </label>
          <select
            id="server-recording"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={selectedServerRecording}
            disabled={
              recordingsQuery.isPending || serverRecordings.length === 0
            }
            onChange={(event) => {
              const recording = serverRecordings.find(
                (item) => item.id === event.target.value
              );
              replaceFile(null);
              setSelectedServerRecording(recording?.id ?? "");
              if (input.current) input.current.value = "";
            }}
          >
            <option value="">
              {m.player_choose_server_recording({}, { locale })}
            </option>
            {serverRecordings.map((recording) => (
              <option key={recording.id} value={recording.id}>
                {recording.meetingTitle} — {recording.original_filename}
              </option>
            ))}
          </select>
          {meetingsQuery.isError || recordingsQuery.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {m.player_server_recordings_error({}, { locale })}
            </p>
          ) : null}
          {meetingsQuery.isSuccess &&
          recordingsQuery.isSuccess &&
          serverRecordings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {m.player_no_server_recordings({}, { locale })}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <label
            htmlFor="local-recording"
            className="block text-sm font-medium"
          >
            {m.player_choose({}, { locale })}
          </label>
          <input
            ref={input}
            id="local-recording"
            type="file"
            accept="audio/*,video/*"
            className="block w-full min-w-0 text-sm file:me-3 file:rounded-md file:border file:bg-background file:px-3 file:py-2 file:text-foreground"
            onChange={(event) => {
              replaceFile(event.target.files?.[0] ?? null);
            }}
          />
          {source && (
            <Button
              variant="outline"
              onClick={() => {
                replaceFile(null);
                if (input.current) input.current.value = "";
              }}
            >
              {m.player_clear({}, { locale })}
            </Button>
          )}
        </div>
      </div>
      {selectedServerMedia ? (
        <div className="space-y-7">
          <MeetingPlayer
            key={selectedServerMedia.id}
            source={selectedServerMedia}
            ref={player}
            onPositionChange={sync.onPositionChange}
            markers={markers}
          />
          {resultVersionQuery.isPending ? (
            <output className="block text-sm text-muted-foreground">
              {m.player_server_transcript_loading({}, { locale })}
            </output>
          ) : resultVersionQuery.isError || segmentsQuery.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {m.player_server_transcript_error({}, { locale })}
            </p>
          ) : !resultVersionQuery.data ? (
            <p className="text-sm text-muted-foreground">
              {m.player_server_transcript_missing({}, { locale })}
            </p>
          ) : segmentsQuery.isPending ? (
            <output className="block text-sm text-muted-foreground">
              {m.player_server_transcript_loading({}, { locale })}
            </output>
          ) : segmentsQuery.data?.length ? (
            <TranscriptPanel key={resultVersionQuery.data.id} sync={sync} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {m.player_server_transcript_empty({}, { locale })}
            </p>
          )}
        </div>
      ) : source ? (
        <div className="space-y-7">
          <MeetingPlayer
            source={source}
            ref={player}
            onPositionChange={sync.onPositionChange}
            markers={markers}
            waveform={waveform}
          />
          {isSample && transcript && (
            <section className="space-y-2 rounded-2xl border bg-card p-5">
              <h2 className="font-medium">
                {m.player_sample_source_title({}, { locale })}
              </h2>
              <p className="text-sm text-muted-foreground">
                {m.player_sample_source_help({}, { locale })}
              </p>
              <Button
                variant="outline"
                onClick={() => sync.seekSegment("synthetic-segment-3")}
              >
                {m.player_sample_source_jump(
                  { time: transcriptTime(8000) },
                  { locale }
                )}
              </Button>
            </section>
          )}
          <div className="space-y-3 rounded-2xl border bg-card p-5">
            <label
              htmlFor="local-transcript"
              className="block text-sm font-medium"
            >
              {m.player_transcript_choose({}, { locale })}
            </label>
            <input
              ref={transcriptInput}
              id="local-transcript"
              type="file"
              accept="application/json,.json"
              className="block w-full min-w-0 text-sm file:me-3 file:rounded-md file:border file:bg-background file:px-3 file:py-2 file:text-foreground"
              onChange={(event) => {
                void importTranscript(event.target.files?.[0] ?? null);
              }}
            />
            <p className="text-sm text-muted-foreground">
              {m.player_transcript_help({}, { locale })}
            </p>
            {transcriptLoading && (
              <output>{m.player_transcript_loading({}, { locale })}</output>
            )}
            {transcriptError && (
              <p role="alert" className="text-sm text-destructive">
                {transcriptErrors[transcriptError]}
              </p>
            )}
            {transcript && (
              <output className="block text-sm">
                {m.player_transcript_loaded(
                  {
                    name: displayedTranscript?.name ?? "",
                    count: transcript.segments.length,
                  },
                  { locale }
                )}
              </output>
            )}
          </div>
          {transcript && <TranscriptPanel sync={sync} />}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {m.player_empty({}, { locale })}
        </p>
      )}
    </section>
  );
};
