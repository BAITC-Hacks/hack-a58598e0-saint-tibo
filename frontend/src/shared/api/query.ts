import type { QueryClient } from "@tanstack/react-query";

/** OpenAPI tags carried by generated query keys; one tag per backend resource. */
export type ResourceTag = "users" | "access" | "health";

/**
 * Invalidate every cached query of one resource.
 *
 * Generated query keys embed the operation's OpenAPI tags, so a single call refreshes
 * all list and detail queries of a resource regardless of their filters or pagination.
 */
export const invalidateResource = (
  queryClient: QueryClient,
  tag: ResourceTag
) => queryClient.invalidateQueries({ queryKey: [{ tags: [tag] }] });
