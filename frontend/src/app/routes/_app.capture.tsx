import { createFileRoute } from "@tanstack/react-router";

import { CapturePage } from "#/pages/capture";

export const Route = createFileRoute("/_app/capture")({
  component: CapturePage,
});
