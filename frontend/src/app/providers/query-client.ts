import { MutationCache, QueryClient } from "@tanstack/react-query";

import { apiErrorMessage } from "#/shared/api";
import { m } from "#/shared/lib/i18n/messages";
import { toast } from "#/shared/ui/shadcn/toast";

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, retry: 1 },
      mutations: { retry: 0 },
    },
    // Failed queries render a route error component; a failed mutation would otherwise be silent.
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (mutation.options.onError) {
          return;
        }
        toast.add({
          type: "error",
          title: m.app_action_failed(),
          description: apiErrorMessage(error, m.app_page_error_help()),
        });
      },
    }),
  });
