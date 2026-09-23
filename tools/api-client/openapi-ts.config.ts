import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "../../contracts/openapi.json",
  output: {
    path: "../../frontend/src/shared/api/generated",
    postProcess: [],
  },
  plugins: [
    "@hey-api/typescript",
    "@hey-api/client-fetch",
    "@hey-api/sdk",
    // `tags` puts the OpenAPI tag into every query key, so one mutation can
    // invalidate a whole resource: invalidateQueries({ queryKey: [{ tags: ["users"] }] }).
    { name: "@tanstack/react-query", queryKeys: { tags: true } },
  ],
});
