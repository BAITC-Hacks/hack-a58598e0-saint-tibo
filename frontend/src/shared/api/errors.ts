import type { ErrorResponse } from "./generated/types.gen";

const isErrorResponse = (value: unknown): value is ErrorResponse => {
  if (typeof value !== "object" || value === null || !("error" in value)) {
    return false;
  }
  const { error } = value;
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  );
};

/** Read the backend error envelope; falls back to the thrown value's message. */
export const apiErrorMessage = (error: unknown, fallback: string): string => {
  if (isErrorResponse(error)) {
    return error.error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

/** Backend error code (`not_found`, `forbidden`, …) when the envelope is present. */
export const apiErrorCode = (error: unknown): string | undefined =>
  isErrorResponse(error) ? error.error.code : undefined;
