import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { forgetAccessToken, mockModeKey } from "../api/backend-client";
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
  const [activeIdentity, setActiveIdentity] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending && cacheIdentity !== identity) {
      forgetAccessToken();
      queryClient.clear();
      // oxlint-disable-next-line react/set-state-in-effect -- Remount only after the external query cache has been cleared.
      setCacheIdentity(identity);
    }
    if (!isPending && activeIdentity !== identity) {
      const userId = data?.user.id;
      if (!userId) {
        sessionStorage.removeItem("saint-tibo-active-user");
        setActiveIdentity(null);
      } else {
        const mode =
          localStorage.getItem(mockModeKey(userId)) === "mock"
            ? "mock"
            : "real";
        void fetch("/api/mock-mode", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode }),
        })
          .then((response) => {
            if (!response.ok) localStorage.setItem(mockModeKey(userId), "real");
          })
          .catch(() => localStorage.setItem(mockModeKey(userId), "real"))
          .finally(() => {
            sessionStorage.setItem("saint-tibo-active-user", userId);
            setActiveIdentity(identity);
          });
      }
    }
  }, [
    cacheIdentity,
    identity,
    isPending,
    queryClient,
    data?.user.id,
    activeIdentity,
  ]);

  // Unmount query observers before clearing; mount the new session only afterwards.
  return cacheIdentity === identity && activeIdentity === identity
    ? children
    : null;
};
