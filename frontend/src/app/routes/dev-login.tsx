import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dev-login")({
  validateSearch: (
    search: Record<string, unknown>
  ): { role: "user" | "admin" } => ({
    role: search.role === "admin" ? "admin" : "user",
  }),
  beforeLoad: async ({ search }) => {
    if (typeof window === "undefined") return;
    const response = await fetch("/api/dev-login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: search.role }),
    });
    // A full navigation refreshes the session and clears any previous account's cache.
    throw redirect({
      href: response.ok ? "/" : "/login",
      reloadDocument: true,
    });
  },
  component: () => null,
});
