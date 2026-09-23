import { createFileRoute } from "@tanstack/react-router";

import { proxyMock } from "#/app/server/mock-mode.server";

export const Route = createFileRoute("/api/mock/$")({
  server: {
    handlers: {
      GET: ({ request }) => proxyMock(request),
      HEAD: ({ request }) => proxyMock(request),
      POST: ({ request }) => proxyMock(request),
      PATCH: ({ request }) => proxyMock(request),
      PUT: ({ request }) => proxyMock(request),
      DELETE: ({ request }) => proxyMock(request),
    },
  },
});
