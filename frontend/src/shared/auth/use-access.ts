import { useQuery } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";

import { backendClient } from "../api/backend-client";
import { getCurrentUser } from "../api/generated/sdk.gen";
import type { Permission } from "../api/generated/types.gen";
import { authClient } from "./auth-client";
import {
  hasAnyPermission,
  hasEveryPermission,
  hasPermission,
} from "./permissions";

export const accessQueryKey = ["auth", "access"] as const;

export const invalidateAccess = async (queryClient: QueryClient) => {
  await queryClient.invalidateQueries({ queryKey: accessQueryKey });
};

export const useAccess = () => {
  const session = authClient.useSession();
  const query = useQuery({
    queryKey: [...accessQueryKey, session.data?.session.id ?? null],
    queryFn: async ({ signal }) => {
      const { data } = await getCurrentUser({
        client: backendClient,
        signal,
        throwOnError: true,
      });
      return data;
    },
    enabled: !session.isPending && Boolean(session.data?.session.id),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
  });
  // Never grant from old data after logout, a failed refresh or a session switch.
  const user =
    session.data && !session.isPending && !session.error && !query.isError
      ? (query.data ?? null)
      : null;
  return {
    user,
    isPending: session.isPending || (Boolean(session.data) && query.isPending),
    error: session.error ?? query.error,
    can: (permission: Permission) => hasPermission(user, permission),
    canAny: (permissions: readonly Permission[]) =>
      hasAnyPermission(user, permissions),
    canAll: (permissions: readonly Permission[]) =>
      hasEveryPermission(user, permissions),
    refetch: query.refetch,
  };
};
