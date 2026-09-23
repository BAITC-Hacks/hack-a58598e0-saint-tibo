import { createFileRoute } from "@tanstack/react-router";

import { NotificationsPage } from "#/pages/reminders";

export const Route = createFileRoute("/_app/notifications")({
  component: NotificationsPage,
});
