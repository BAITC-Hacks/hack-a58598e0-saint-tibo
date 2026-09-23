import { createFileRoute } from "@tanstack/react-router";

import { MeetingsPage } from "#/pages/meeting-workspace";
import { requireAccess } from "#/shared/auth";

export const Route = createFileRoute("/_app/meetings/")({
  beforeLoad: ({ location }) =>
    requireAccess({ permissions: ["meeting:read"], returnTo: location.href }),
  component: MeetingsPage,
});
