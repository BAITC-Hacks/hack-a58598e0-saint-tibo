import { createFileRoute } from "@tanstack/react-router";

import { LoginPage } from "#/pages/login";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const destination = search.redirect;
    return typeof destination === "string" &&
      destination.startsWith("/") &&
      !destination.startsWith("//") &&
      !destination.includes("\\")
      ? { redirect: destination }
      : {};
  },
  component: LoginPage,
});
