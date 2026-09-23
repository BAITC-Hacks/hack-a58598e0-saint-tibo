import { createFileRoute } from "@tanstack/react-router";

import { OrgAskPage } from "#/pages/org-ask";

export const Route = createFileRoute("/_app/ask")({
  component: OrgAskPage,
});
