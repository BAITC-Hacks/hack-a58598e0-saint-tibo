import { createFileRoute } from "@tanstack/react-router";

import { SurfacesPage } from "#/pages/meeting-workspace";

export const Route = createFileRoute("/_app/people/$personId")({
  component: () => (
    <SurfacesPage kind="person" personId={Route.useParams().personId} />
  ),
});
