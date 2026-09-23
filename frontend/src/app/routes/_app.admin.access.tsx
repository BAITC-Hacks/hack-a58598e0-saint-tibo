import { createFileRoute } from "@tanstack/react-router";

import { SurfacesPage } from "#/pages/meeting-workspace";
import { requireAccess } from "#/shared/auth";

export const Route = createFileRoute("/_app/admin/access")({
  beforeLoad: ({ location }) =>
    requireAccess({ permissions: ["access:read"], returnTo: location.href }),
  component: () => <SurfacesPage kind="adminAccess" />,
});
