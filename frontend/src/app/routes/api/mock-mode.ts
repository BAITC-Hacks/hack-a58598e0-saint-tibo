import { createFileRoute } from "@tanstack/react-router";

import { mockMode } from "#/app/server/mock-mode.server";

export const Route = createFileRoute("/api/mock-mode")({
  server: {
    handlers: {
      GET: ({ request }) => mockMode(request),
      POST: ({ request }) => mockMode(request),
    },
  },
});
