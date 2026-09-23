import { createFileRoute } from "@tanstack/react-router";

import { CreateMeetingPage } from "#/pages/meeting-workspace";
import { requireAccess } from "#/shared/auth";

export const Route = createFileRoute("/_app/meetings/new")({
  beforeLoad: ({ location }) =>
    requireAccess({ permissions: ["meeting:write"], returnTo: location.href }),
  component: CreateMeetingPage,
});
