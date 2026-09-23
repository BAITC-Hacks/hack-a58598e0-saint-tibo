import { createFileRoute } from "@tanstack/react-router";

import { SurfacesPage } from "#/pages/meeting-workspace";
import { requireAccess } from "#/shared/auth";

export const Route = createFileRoute("/_app/admin/people")({
  beforeLoad: ({ location }) =>
    requireAccess({ permissions: ["users:read"], returnTo: location.href }),
  component: () => <SurfacesPage kind="adminDirectory" />,
});
