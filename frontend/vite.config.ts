import { paraglideVitePlugin } from "@inlang/paraglide-js";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { paraglideConfig } from "./paraglide.config.ts";

// Ports come from the root .env so a worktree can run its own stack without clashing.
const port = Number(process.env.FRONTEND_PORT ?? 3000);

const config = defineConfig(() => {
  return {
    resolve: { tsconfigPaths: true },
    server: { port, strictPort: true },
    preview: { port, strictPort: true },
    plugins: [
      paraglideVitePlugin(paraglideConfig),
      tailwindcss(),
      tanstackStart({
        router: {
          entry: "app/router.tsx",
          routesDirectory: "app/routes",
          generatedRouteTree: "app/routeTree.gen.ts",
        },
        start: { entry: "app/start.ts" },
        spa: { enabled: true },
      }),
      viteReact(),
      babel({ presets: [reactCompilerPreset()] }),
    ],
  };
});

export default config;
