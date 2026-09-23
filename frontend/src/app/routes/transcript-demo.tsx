import { createFileRoute } from "@tanstack/react-router";

import { TranscriptDemoPage } from "#/pages/transcript-demo";

// Public, synthetic-only fixture. Real meeting pages retain their existing auth gate.
export const Route = createFileRoute("/transcript-demo")({
  component: TranscriptDemoPage,
});
