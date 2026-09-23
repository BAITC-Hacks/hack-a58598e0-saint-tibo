import { createFileRoute } from "@tanstack/react-router";

import { MeetingPage } from "#/pages/meeting-workspace";
import { requireAccess } from "#/shared/auth";

export const Route = createFileRoute("/_app/meetings/$meetingId")({
  beforeLoad: ({ location }) =>
    requireAccess({ permissions: ["meeting:read"], returnTo: location.href }),
  component: () => <MeetingPage meetingId={Route.useParams().meetingId} />,
});
