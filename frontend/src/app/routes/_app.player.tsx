import { createFileRoute } from "@tanstack/react-router";

import { PlayerPage } from "#/pages/player";
import { WorkspacePage } from "#/pages/workspace";
import { m } from "#/shared/lib/i18n/messages";
import { useLocale } from "#/shared/lib/locales";
import { usePersistentPlayer } from "#/shared/ui/meeting-player";

function PlayerWithWorkflow() {
  const locale = useLocale();
  const player = usePersistentPlayer();
  return (
    <div className="space-y-7">
      <PlayerPage />
      <details className="mx-auto max-w-7xl rounded-2xl border bg-card p-5">
        <summary className="cursor-pointer text-xl font-semibold">
          {m.player_workflow_title({}, { locale })}
        </summary>
        <p className="mt-2 text-sm text-muted-foreground">
          {m.player_workflow_help({}, { locale })}
        </p>
        <div className="mt-5">
          <WorkspacePage
            embedded
            initialMeetingId={player.source?.meetingId ?? ""}
          />
        </div>
      </details>
    </div>
  );
}

export const Route = createFileRoute("/_app/player")({
  component: PlayerWithWorkflow,
});
