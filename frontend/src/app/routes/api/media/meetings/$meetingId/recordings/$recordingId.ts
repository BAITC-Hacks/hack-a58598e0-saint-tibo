import { createFileRoute } from "@tanstack/react-router";

import { proxyRecordingMedia } from "#/app/server/media.server";

export const Route = createFileRoute(
  "/api/media/meetings/$meetingId/recordings/$recordingId"
)({
  server: {
    handlers: {
      GET: ({ request, params }) => proxyRecordingMedia(request, params),
      HEAD: ({ request, params }) => proxyRecordingMedia(request, params),
      ANY: ({ request, params }) => proxyRecordingMedia(request, params),
    },
  },
});
