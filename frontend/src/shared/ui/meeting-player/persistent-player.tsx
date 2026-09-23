import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

import { backendClient, getMeeting, getRecording } from "#/shared/api";
import { authClient } from "#/shared/auth";
import { m } from "#/shared/lib/i18n/messages";
import { useLocale } from "#/shared/lib/locales";

import { MeetingPlayer } from "./meeting-player";
import {
  forgetSelectedRecording,
  savedPosition,
  savedRecording,
  savePosition,
  saveSelectedRecording,
} from "./resume-position";
import type {
  MediaSource,
  MeetingPlayerHandle,
  PlaybackPosition,
  TimelineMarker,
} from "./types";

type ServerSource = MediaSource & { meetingId: string };
type Controller = {
  source: ServerSource | null;
  position: PlaybackPosition | null;
  select: (source: ServerSource) => void;
  clear: () => void;
  seek: (positionMs: number) => void;
  setDetails: (
    markers: readonly TimelineMarker[],
    waveform: readonly number[] | null
  ) => void;
};

const Context = createContext<Controller | null>(null);

export function usePersistentPlayer() {
  const controller = useContext(Context);
  if (!controller) throw new Error("PersistentPlayerProvider is missing");
  return controller;
}

export function PersistentPlayerProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [source, setSource] = useState<ServerSource | null>(null);
  const [position, setPosition] = useState<PlaybackPosition | null>(null);
  const [details, setDetailsState] = useState<{
    markers: readonly TimelineMarker[];
    waveform: readonly number[] | null;
  }>({ markers: [], waveform: null });
  const [remembered] = useState<ReturnType<typeof savedRecording>>(() =>
    typeof window === "undefined" ? undefined : savedRecording()
  );
  const player = useRef<MeetingPlayerHandle>(null);
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const locale = useLocale();

  const restored = useQuery({
    queryKey: [
      "player",
      "restore",
      session?.session.id,
      remembered?.meetingId,
      remembered?.recordingId,
    ],
    enabled: Boolean(session && !sessionPending && remembered),
    retry: false,
    queryFn: async ({ signal }) => {
      if (!remembered) return null;
      const [meeting, recording] = await Promise.all([
        getMeeting({
          client: backendClient,
          path: { meeting_id: remembered.meetingId },
          signal,
          throwOnError: true,
        }),
        getRecording({
          client: backendClient,
          path: {
            meeting_id: remembered.meetingId,
            recording_id: remembered.recordingId,
          },
          signal,
          throwOnError: true,
        }),
      ]);
      if (!recording.data.media_url || !recording.data.media_content_type)
        return null;
      return {
        id: recording.data.id,
        meetingId: remembered.meetingId,
        url: recording.data.media_url,
        title: `${meeting.data.title} — ${recording.data.original_filename}`,
      };
    },
  });

  useEffect(() => {
    if (restored.isError || (restored.isSuccess && !restored.data)) {
      forgetSelectedRecording();
      return;
    }
    // oxlint-disable-next-line react/set-state-in-effect -- A successful authorization query is the external source of the restored player.
    if (restored.data) setSource((current) => current ?? restored.data);
  }, [restored.data, restored.isError, restored.isSuccess]);

  useEffect(() => {
    if (!sessionPending && !session) {
      player.current?.pause();
      // oxlint-disable-next-line react/set-state-in-effect -- Session loss must revoke the active media source immediately.
      setSource(null);
      setPosition(null);
    }
  }, [session, sessionPending]);

  const select = (next: ServerSource) => {
    if (source?.id === next.id && source.meetingId === next.meetingId) return;
    player.current?.pause();
    saveSelectedRecording(next.meetingId, next.id);
    setPosition(null);
    setDetailsState({ markers: [], waveform: null });
    setSource(next);
  };
  const clear = () => {
    player.current?.pause();
    forgetSelectedRecording();
    setSource(null);
    setPosition(null);
  };
  const onPositionChange = (next: PlaybackPosition) => {
    if (!source || next.sourceId !== source.id) return;
    setPosition(next);
    savePosition(source.meetingId, source.id, next.positionMs, next.durationMs);
  };
  const setDetails = useCallback(
    (
      markers: readonly TimelineMarker[],
      waveform: readonly number[] | null
    ) => {
      setDetailsState({ markers, waveform });
    },
    []
  );

  return (
    <Context
      value={{
        source,
        position,
        select,
        clear,
        seek: (ms) => player.current?.seek(ms),
        setDetails,
      }}
    >
      {source && session && !sessionPending && (
        <div
          className={
            pathname === "/player"
              ? "mb-7"
              : "fixed inset-x-2 bottom-2 z-40 mx-auto max-w-3xl shadow-xl sm:inset-x-4"
          }
        >
          <MeetingPlayer
            source={source}
            ref={player}
            compact={pathname !== "/player"}
            initialPositionMs={savedPosition(source.id)}
            onPositionChange={onPositionChange}
            markers={details.markers}
            waveform={details.waveform}
          />
          {pathname !== "/player" && (
            <Link
              to="/player"
              className="absolute end-4 bottom-3 rounded-md px-2 py-1 text-xs font-medium text-primary underline focus-visible:outline-2 focus-visible:outline-ring"
            >
              {m.player_open_page({}, { locale })}
            </Link>
          )}
        </div>
      )}
      {children}
    </Context>
  );
}
