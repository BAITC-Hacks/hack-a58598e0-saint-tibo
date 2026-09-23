import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import {
  backendClient,
  getResultReview,
  listMeetings,
  listParticipants,
  listRecordings,
} from "#/shared/api";
import { m } from "#/shared/lib/i18n/messages";
import { useLocale } from "#/shared/lib/locales";
import { speakerColor, usePersistentPlayer } from "#/shared/ui/meeting-player";
import type { SpeakerInterval } from "#/shared/ui/meeting-player";
import {
  TranscriptPanel,
  useTranscriptSync,
} from "#/shared/ui/transcript-sync";

import { readAudioWaveform } from "../lib/audio-waveform";
import {
  allTranscriptSegments,
  latestCompletedResult,
} from "../lib/server-transcript";

const noSegments: never[] = [];

/** Protected meeting recordings and their persisted transcript share one timeline. */
export const PlayerPage = () => {
  const locale = useLocale();
  const player = usePersistentPlayer();
  const [speakerFilter, setSpeakerFilter] = useState("");
  const selectedServerRecording = player.source?.id ?? "";

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
  const activeSegments = segmentsQuery.data ?? noSegments;
  const reviewQuery = useQuery({
    queryKey: [
      "player",
      "review-speakers",
      selectedServerSource?.id,
      resultVersionQuery.data?.id,
    ],
    enabled: Boolean(selectedServerSource && resultVersionQuery.data),
    queryFn: async ({ signal }) => {
      if (!selectedServerSource || !resultVersionQuery.data) return null;
      const response = await getResultReview({
        client: backendClient,
        path: {
          meeting_id: selectedServerSource.meeting_id,
          recording_id: selectedServerSource.id,
          result_version_id: resultVersionQuery.data.id,
        },
        signal,
        throwOnError: true,
      });
      return response.data;
    },
  });
  const participantsQuery = useQuery({
    queryKey: ["player", "participants", selectedServerSource?.meeting_id],
    enabled: Boolean(selectedServerSource),
    queryFn: async ({ signal }) => {
      if (!selectedServerSource) return [];
      const response = await listParticipants({
        client: backendClient,
        path: { meeting_id: selectedServerSource.meeting_id },
        query: { limit: 100, offset: 0 },
        signal,
        throwOnError: true,
      });
      return response.data.items;
    },
  });
  const speakers = useMemo(() => {
    const identities = new Map(
      (reviewQuery.data?.speakers ?? []).map((speaker) => [
        speaker.speaker_id,
        speaker,
      ])
    );
    const participants = new Map(
      (participantsQuery.data ?? []).map((participant) => [
        participant.id,
        participant,
      ])
    );
    const byId = new Map<
      string,
      { id: string; label: string; color: string }
    >();
    for (const segment of activeSegments) {
      if (!segment.speaker_id) continue;
      const original = identities.get(segment.speaker_id);
      const canonical = original?.merged_into_speaker_id
        ? (identities.get(original.merged_into_speaker_id) ?? original)
        : original;
      const id = canonical?.speaker_id ?? segment.speaker_id;
      if (byId.has(id)) continue;
      byId.set(id, {
        id,
        label:
          participants.get(canonical?.participant_id ?? "")?.display_name ??
          canonical?.label ??
          id,
        color: speakerColor(byId.size),
      });
    }
    return { rows: [...byId.values()], identities };
  }, [activeSegments, participantsQuery.data, reviewQuery.data]);
  const speakerIntervals = useMemo<SpeakerInterval[]>(
    () =>
      activeSegments.flatMap((segment) => {
        if (!segment.speaker_id) return [];
        const original = speakers.identities.get(segment.speaker_id);
        const id = original?.merged_into_speaker_id ?? segment.speaker_id;
        const speaker = speakers.rows.find((row) => row.id === id);
        return speaker
          ? [
              {
                startMs: segment.start_ms,
                endMs: segment.end_ms,
                speakerId: id,
                label: speaker.label,
                color: speaker.color,
              },
            ]
          : [];
      }),
    [activeSegments, speakers]
  );
  const speakingMs = new Map<string, number>();
  for (const interval of speakerIntervals)
    speakingMs.set(
      interval.speakerId,
      (speakingMs.get(interval.speakerId) ?? 0) +
        interval.endMs -
        interval.startMs
    );
  const totalSpeakingMs = [...speakingMs.values()].reduce(
    (sum, ms) => sum + ms,
    0
  );
  const sync = useTranscriptSync({
    recordingId: selectedServerMedia?.id ?? "",
    resultVersionId: resultVersionQuery.data?.id ?? "",
    segments: activeSegments,
    seek: player.seek,
    playbackPosition: player.position,
  });
  const markers = useMemo(
    () =>
      activeSegments.length
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
        : [],
    [activeSegments]
  );
  const setDetails = player.setDetails;
  useEffect(() => {
    setDetails(markers, waveformQuery.data ?? null, speakerIntervals);
  }, [markers, setDetails, speakerIntervals, waveformQuery.data]);

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
              const recording = serverRecordings.find(
                (item) => item.id === event.target.value
              );
              if ((recording?.id ?? "") !== selectedServerRecording) {
                setSpeakerFilter("");
              }
              if (recording?.media_url) {
                player.select({
                  id: recording.id,
                  meetingId: recording.meeting_id,
                  url: recording.media_url,
                  title: `${recording.meetingTitle} — ${recording.original_filename}`,
                });
              } else player.clear();
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
          {speakers.rows.length > 0 && (
            <div
              className="flex flex-wrap gap-2"
              aria-label={
                locale === "ru"
                  ? "Говорящие"
                  : locale === "kk"
                    ? "Сөйлеушілер"
                    : "Speakers"
              }
            >
              {speakers.rows.map((speaker) => {
                const share = totalSpeakingMs
                  ? Math.round(
                      ((speakingMs.get(speaker.id) ?? 0) / totalSpeakingMs) *
                        100
                    )
                  : 0;
                return (
                  <div
                    key={speaker.id}
                    className="flex items-center gap-1 rounded-full border bg-card p-1 text-xs"
                  >
                    <span
                      className="ms-1 size-2.5 rounded-full"
                      style={{ backgroundColor: speaker.color }}
                      aria-hidden="true"
                    />
                    <button
                      type="button"
                      className="max-w-40 truncate px-1 font-medium aria-pressed:underline"
                      aria-pressed={speakerFilter === speaker.id}
                      onClick={() => {
                        setSpeakerFilter(
                          speakerFilter === speaker.id ? "" : speaker.id
                        );
                        player.stopSolo();
                      }}
                    >
                      {speaker.label} {share}%
                    </button>
                    <button
                      type="button"
                      className="rounded-full border px-2 py-1 hover:bg-accent"
                      aria-pressed={player.soloSpeakerId === speaker.id}
                      onClick={() => {
                        if (player.soloSpeakerId === speaker.id)
                          player.stopSolo();
                        else {
                          const first = speakerIntervals.find(
                            (interval) => interval.speakerId === speaker.id
                          );
                          if (first) {
                            setSpeakerFilter(speaker.id);
                            player.listenSpeaker(speaker.id, first.startMs);
                          }
                        }
                      }}
                    >
                      {player.soloSpeakerId === speaker.id
                        ? locale === "ru"
                          ? "Все голоса"
                          : locale === "kk"
                            ? "Барлық дауыс"
                            : "All voices"
                        : locale === "ru"
                          ? "Слушать"
                          : locale === "kk"
                            ? "Тыңдау"
                            : "Listen"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
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
            <TranscriptPanel
              key={resultVersionQuery.data.id}
              sync={sync}
              speakerFilter={speakerFilter}
              speakers={speakers.rows}
              canonicalSpeaker={(id) =>
                speakers.identities.get(id)?.merged_into_speaker_id ?? id
              }
            />
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
