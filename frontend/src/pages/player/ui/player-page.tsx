import { useEffect, useRef, useState } from "react";

import { m } from "#/shared/lib/i18n/messages";
import { useLocale } from "#/shared/lib/locales";
import { MeetingPlayer } from "#/shared/ui/meeting-player";
import type {
  MediaSource,
  MeetingPlayerHandle,
} from "#/shared/ui/meeting-player";
import { Button } from "#/shared/ui/shadcn/button";

/** Local playback lets the media component be exercised before server ingestion lands. */
export const PlayerPage = () => {
  const locale = useLocale();
  const [source, setSource] = useState<MediaSource | null>(null);
  const ownedUrl = useRef<string | null>(null);
  const player = useRef<MeetingPlayerHandle>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (ownedUrl.current) URL.revokeObjectURL(ownedUrl.current);
    },
    []
  );

  const replaceFile = (file: File | null) => {
    player.current?.pause();
    if (ownedUrl.current) URL.revokeObjectURL(ownedUrl.current);
    const url = file ? URL.createObjectURL(file) : null;
    ownedUrl.current = url;
    setSource(file && url ? { id: url, url, title: file.name } : null);
  };

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">
          {m.player_page({}, { locale })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {m.player_local_help({}, { locale })}
        </p>
      </div>
      <div className="space-y-3 rounded-lg border p-4">
        <label htmlFor="local-recording" className="block text-sm font-medium">
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
      {source ? (
        <MeetingPlayer source={source} ref={player} />
      ) : (
        <p className="text-sm text-muted-foreground">
          {m.player_empty({}, { locale })}
        </p>
      )}
    </section>
  );
};
