import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { forgetAccessToken } from "../api/backend-client";
import { authClient } from "./auth-client";

/** Prevent private cached data from surviving logout or a switch to another session. */
export const AuthCacheBoundary = ({
  children,
}: {
  children: ReactNode;
}): ReactNode => {
  const { data, isPending } = authClient.useSession();
  const queryClient = useQueryClient();
  const identity = data?.session.id ?? null;
  const [cacheIdentity, setCacheIdentity] = useState(identity);

  useEffect(() => {
    if (!isPending && cacheIdentity !== identity) {
      forgetAccessToken();
      queryClient.clear();
      // oxlint-disable-next-line react/set-state-in-effect -- Remount only after the external query cache has been cleared.
      setCacheIdentity(identity);
    }
  }, [cacheIdentity, identity, isPending, queryClient]);

  // Unmount query observers before clearing; mount the new session only afterwards.
  return cacheIdentity === identity ? children : null;
};
