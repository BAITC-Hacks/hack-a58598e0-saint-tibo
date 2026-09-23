import { defineConfig } from "oxlint";

export default defineConfig({
  options: {
    typeAware: true,
    typeCheck: true,
    denyWarnings: true,
    reportUnusedDisableDirectives: "error",
  },
  plugins: ["typescript", "unicorn", "oxc", "react", "jsx-a11y", "import"],
  categories: { correctness: "error", suspicious: "error" },
  rules: {
    "react/react-in-jsx-scope": "off", // React automatic JSX runtime.
    "import/no-cycle": "error",
    "typescript/no-floating-promises": "error",
    "typescript/no-misused-promises": "error",
    "react-hooks/exhaustive-deps": "error",
    "react/exhaustive-effect-dependencies": "off", // Covered by exhaustive-deps.
  },
  ignorePatterns: [
    "dist/**",
    ".output/**",
    ".tanstack/**",
    "src/app/routeTree.gen.ts",
    "src/shared/ui/shadcn/**",
    "src/shared/lib/i18n/**",
    "src/shared/api/generated/**",
  ],
});
