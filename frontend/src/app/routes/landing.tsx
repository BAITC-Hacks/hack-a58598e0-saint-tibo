import { createFileRoute } from "@tanstack/react-router";

import { LandingPage } from "#/pages/landing";

export const Route = createFileRoute("/landing")({ component: LandingPage });
