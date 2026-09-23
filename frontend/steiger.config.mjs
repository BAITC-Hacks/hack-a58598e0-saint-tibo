import fsd from "@feature-sliced/steiger-plugin";
import { defineConfig } from "steiger";

export default defineConfig([
  ...fsd.configs.recommended,
  // These directory names are framework routes and the agreed application bootstrap.
  {
    files: ["src/app/routes/**"],
    rules: { "fsd/no-reserved-folder-names": "off" },
  },
  {
    files: ["src/app/providers/**"],
    rules: { "fsd/segments-by-purpose": "off" },
  },
  {
    ignores: [
      "src/app/routeTree.gen.ts",
      "src/shared/lib/i18n/**",
      "src/shared/ui/shadcn/**",
    ],
  },
]);
