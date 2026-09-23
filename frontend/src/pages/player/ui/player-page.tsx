import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { backendClient, listMeetings, listRecordings } from "#/shared/api";
import { m } from "#/shared/lib/i18n/messages";
import { useLocale } from "#/shared/lib/locales";
import { MeetingPlayer } from "#/shared/ui/meeting-player";
import type {
  MeetingPlayerHandle,
  TimelineMarker,
} from "#/shared/ui/meeting-player";
import {
  TranscriptPanel,
  useTranscriptSync,
} from "#/shared/ui/transcript-sync";

import { readAudioWaveform } from "../lib/audio-waveform";
import {
  allTranscriptSegments,
  latestCompletedResult,
} from "../lib/server-transcript";

/** Protected meeting recordings and their persisted transcript share one timeline. */
export const PlayerPage = () => {
  const locale = useLocale();
  const [selectedServerRecording, setSelectedServerRecording] = useState("");
  const player = useRef<MeetingPlayerHandle>(null);

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
  const waveformQuery = useQuery({
    queryKey: ["player", "waveform", selectedServerSource?.id],
    enabled: Boolean(
      selectedServerMedia &&
      selectedServerSource?.media_size_bytes &&
      selectedServerSource.media_size_bytes <= 32 * 1024 * 1024
    ),
    queryFn: async ({ signal }) => {
      if (!selectedServerMedia) return null;
      const response = await fetch(selectedServerMedia.url, {
        credentials: "same-origin",
        signal,
      });
      if (!response.ok) return null;
      const blob = await response.blob();
      if (blob.size > 32 * 1024 * 1024) return null;
      return readAudioWaveform(new File([blob], selectedServerMedia.title));
    },
  });
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
  const activeSegments = segmentsQuery.data ?? [];
  const sync = useTranscriptSync({
    recordingId: selectedServerMedia?.id ?? "",
    resultVersionId: resultVersionQuery.data?.id ?? "",
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

  return (
    <section className="mx-auto max-w-7xl space-y-7">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {m.player_page({}, { locale })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {m.player_server_help({}, { locale })}
        </p>
      </div>
      <div className="rounded-2xl border bg-card p-5">
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
              setSelectedServerRecording(event.target.value);
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
      </div>
      {selectedServerMedia ? (
        <div className="space-y-7">
          <MeetingPlayer
            key={selectedServerMedia.id}
            source={selectedServerMedia}
            ref={player}
            onPositionChange={sync.onPositionChange}
            markers={markers}
            waveform={waveformQuery.data ?? null}
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
      ) : (
        <p className="text-sm text-muted-foreground">
          {m.player_choose_server_recording({}, { locale })}
        </p>
      )}
    </section>
  );
};
