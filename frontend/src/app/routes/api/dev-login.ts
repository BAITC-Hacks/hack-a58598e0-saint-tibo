import { createFileRoute } from "@tanstack/react-router";

import { devLogin } from "#/app/server/dev-login.server";

export const Route = createFileRoute("/api/dev-login")({
  server: {
    handlers: {
      POST: ({ request }) => devLogin(request),
      ANY: ({ request }) => devLogin(request),
    },
  },
});
