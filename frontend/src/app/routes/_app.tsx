import { createFileRoute, Outlet } from "@tanstack/react-router";

import { requireAccess } from "#/shared/auth";

import { AppShell } from "../layouts/app-shell";

export const Route = createFileRoute("/_app")({
  beforeLoad: ({ location }) =>
    requireAccess({ permissions: ["profile:read"], returnTo: location.href }),
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
