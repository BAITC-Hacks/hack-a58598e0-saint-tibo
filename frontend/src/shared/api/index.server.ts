// Server-safe entry point: never import browser hooks or `backendClient` on the server.
export { createBackendClient } from "./backend-client.server";
export * from "./generated";
