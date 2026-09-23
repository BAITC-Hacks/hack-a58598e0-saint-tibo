import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    "src/shared/lib/i18n/**",
    "src/shared/api/generated/**",
    // Vendored by `bun run ui:add`; kept exactly as the registry emits them.
    "src/shared/ui/shadcn/**",
  ],
  sortTailwindcss: {
    ...(typeof ultracite.sortTailwindcss === "object"
      ? ultracite.sortTailwindcss
      : {}),
    stylesheet: "./src/app/styles/globals.css",
  },
});
