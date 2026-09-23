import { createFileRoute } from "@tanstack/react-router";

import { SurfacesPage } from "#/pages/meeting-workspace";

export const Route = createFileRoute("/_app/people/")({
  component: () => <SurfacesPage kind="people" />,
});
