import { createFileRoute } from "@tanstack/react-router";

import { PlayerPage } from "#/pages/player";

export const Route = createFileRoute("/_app/player")({ component: PlayerPage });
