import { createFileRoute } from "@tanstack/react-router";

import { SurfacesPage } from "#/pages/meeting-workspace";

export const Route = createFileRoute("/_app/briefing")({
  component: () => <SurfacesPage kind="briefing" />,
});
