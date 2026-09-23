import { APIError } from "better-auth/api";

import type { ErrorResponse } from "#/shared/api";
import { serverEnv } from "#/shared/config/index.server";

import { auth } from "./auth.server";
import { mockSelectedFor, proxyMock } from "./mock-mode.server";

const uuidPattern =
  /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const requestHeaderNames = ["range", "if-range", "if-none-match"];
const responseHeaderNames = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "etag",
  "last-modified",
];

const privateHeaders = () =>
  new Headers({
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "same-origin",
  });

const mediaError = (
  request: Request,
  status: number,
  code: string,
  message: string
): Response => {
  const headers = privateHeaders();
  headers.set("Content-Type", "application/json");
  const body: ErrorResponse = { error: { code, message, details: null } };
  return new Response(request.method === "HEAD" ? null : JSON.stringify(body), {
    status,
    headers,
  });
};

/** Cookie-authenticated streaming endpoint for native audio elements. */
export const proxyRecordingMedia = async (
  request: Request,
  params: { meetingId: string; recordingId: string }
): Promise<Response> => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    const response = mediaError(
      request,
      405,
      "method_not_allowed",
      "Use GET or HEAD to read recording media."
    );
    response.headers.set("Allow", "GET, HEAD");
    return response;
  }
  if (
    !uuidPattern.test(params.meetingId) ||
    !uuidPattern.test(params.recordingId)
  ) {
    return mediaError(
      request,
      422,
      "validation_error",
      "Meeting and recording IDs must be UUIDs."
    );
  }

  if (await mockSelectedFor(request)) {
    return proxyMock(
      new Request(
        new URL(
          `/api/mock/api/v1/meetings/${params.meetingId}/recordings/${params.recordingId}/media`,
          request.url
        ),
        request
      )
    );
  }

  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if (
    (origin && origin !== new URL(serverEnv.betterAuthUrl).origin) ||
    (site && site !== "same-origin" && site !== "none")
  ) {
    return mediaError(
      request,
      403,
      "forbidden",
      "Same-origin access required."
    );
  }

  const cookie = request.headers.get("cookie");
  if (!cookie) {
    return mediaError(request, 401, "unauthorized", "Authentication required.");
  }

  let token: string;
  try {
    // Browser Authorization and query parameters are never authentication inputs.
    ({ token } = await auth.api.getToken({ headers: new Headers({ cookie }) }));
  } catch (error) {
    if (error instanceof APIError && error.statusCode === 401) {
      return mediaError(
        request,
        401,
        "unauthorized",
        "Authentication required."
      );
    }
    return mediaError(
      request,
      503,
      "auth_unavailable",
      "Authentication is temporarily unavailable."
    );
  }

  const headers = new Headers({
    Authorization: `Bearer ${token}`,
    // Keep Content-Length and byte ranges aligned with the streamed body.
    "Accept-Encoding": "identity",
  });
  for (const name of requestHeaderNames) {
    const value = request.headers.get(name);
    if (value !== null) {
      headers.set(name, value);
    }
  }

  const upstreamController = new AbortController();
  const abortUpstream = () => {
    upstreamController.abort(request.signal.reason);
    request.signal.removeEventListener("abort", abortUpstream);
  };
  request.signal.addEventListener("abort", abortUpstream, { once: true });
  if (request.signal.aborted) {
    abortUpstream();
  }
  const detachAbort = () =>
    request.signal.removeEventListener("abort", abortUpstream);

  try {
    const path = `/api/v1/meetings/${params.meetingId}/recordings/${params.recordingId}/media`;
    const upstream = await fetch(new URL(path, serverEnv.backendInternalUrl), {
      method: request.method,
      headers,
      signal: upstreamController.signal,
      redirect: "error",
      cache: "no-store",
    });
    const responseHeaders = privateHeaders();
    for (const name of responseHeaderNames) {
      const value = upstream.headers.get(name);
      if (value !== null) {
        responseHeaders.set(name, value);
      }
    }
    if (request.method === "HEAD" || !upstream.body) {
      detachAbort();
      if (upstream.body) {
        void upstream.body.cancel().catch(() => {});
      }
      return new Response(null, {
        status: upstream.status,
        headers: responseHeaders,
      });
    }

    const reader = upstream.body.getReader();
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (cancelled) {
            return;
          }
          if (done) {
            detachAbort();
            controller.close();
          } else {
            controller.enqueue(value);
          }
        } catch (error) {
          detachAbort();
          if (cancelled) {
            return;
          }
          if (request.signal.aborted) {
            controller.close();
          } else {
            controller.error(error);
          }
        }
      },
      async cancel(reason) {
        cancelled = true;
        detachAbort();
        upstreamController.abort(reason);
        await reader.cancel(reason).catch(() => {});
      },
    });
    return new Response(body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    detachAbort();
    return mediaError(
      request,
      503,
      "media_unavailable",
      "Recording media is temporarily unavailable."
    );
  }
};
