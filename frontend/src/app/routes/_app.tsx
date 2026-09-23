import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { authClient, requireAccess } from "#/shared/auth";

import { AppShell } from "../layouts/app-shell";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ location }) => {
    if (
      typeof window !== "undefined" &&
      new URL(location.href, window.location.origin).searchParams.get(
        "auth"
      ) !== "manual"
    ) {
      const session = await authClient.getSession();
      if (!session.data && !session.error) {
        const response = await fetch("/api/dev-login", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "user" }),
        });
        if (response.ok) {
          const signedIn = await authClient.getSession({
            query: { disableCookieCache: true },
          });
          // If cookies are blocked, fall through to manual login instead of reloading forever.
          if (signedIn.data) {
            throw redirect({ href: location.href, reloadDocument: true });
          }
        }
      }
    }
    return requireAccess({
      permissions: ["profile:read"],
      returnTo: location.href,
    });
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
