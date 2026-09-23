import { createFileRoute } from "@tanstack/react-router";

import { BriefingPage } from "#/pages/meeting-workspace";

export const Route = createFileRoute("/_app/briefing")({
  component: BriefingPage,
});
