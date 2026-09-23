import { queryOptions } from "@tanstack/react-query";

import { backendClient, listReminders } from "#/shared/api";

export const REMINDERS_PAGE_SIZE = 20;
export const REMINDERS_REFRESH_MS = 30_000;

export class ReminderLoadError extends Error {
  constructor(readonly status: number) {
    super("Could not load reminders");
  }
}

export const remindersQuery = (sessionId?: string, offset = 0) =>
  queryOptions({
    queryKey: ["reminders", sessionId, offset],
    enabled: typeof window !== "undefined" && !!sessionId,
    staleTime: 15_000,
    retry: false,
    queryFn: async ({ signal }) => {
      const result = await listReminders({
        client: backendClient,
        query: { limit: REMINDERS_PAGE_SIZE, offset },
        signal,
      });
      if (!result.data)
        throw new ReminderLoadError(result.response?.status ?? 0);
      return result.data;
    },
  });
