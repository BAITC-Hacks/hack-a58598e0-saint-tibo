import type { CompilerOptions } from "@inlang/paraglide-js";

export const paraglideConfig = {
  project: "./project.inlang",
  outdir: "./src/shared/lib/i18n",
  strategy: ["cookie", "baseLocale"],
} satisfies CompilerOptions;
