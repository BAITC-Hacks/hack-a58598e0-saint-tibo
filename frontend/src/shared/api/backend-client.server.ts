import { createClient } from "./generated/client/client.gen";
import { createConfig } from "./generated/client/utils.gen";

/**
 * One client per server request, carrying that request's access token.
 *
 * Server code must not use `backendClient`: it resolves the token from the browser session.
 */
export const createBackendClient = (options: {
  baseUrl: string;
  getAccessToken: () => Promise<string | undefined>;
}) =>
  createClient(
    createConfig({ baseUrl: options.baseUrl, auth: options.getAccessToken })
  );
