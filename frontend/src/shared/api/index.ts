// Everything the generator emits, plus the hand-written client and helpers.
export * from "./generated";
export * from "./generated/@tanstack/react-query.gen";
export { jsonBodySerializer } from "./generated/client";
export {
  backendClient,
  forgetAccessToken,
  isMockApi,
  mockModeKey,
} from "./backend-client";
export { apiErrorCode, apiErrorMessage } from "./errors";
export { invalidateResource } from "./query";
export type { ResourceTag } from "./query";
