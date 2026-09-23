import type { QueryClient } from "@tanstack/react-query";
import {
  ClientOnly,
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import { AuthCacheBoundary } from "#/shared/auth";
import { env } from "#/shared/config";
import { A11Y_INIT_SCRIPT } from "#/shared/lib/a11y-settings";
import { getTextDirection } from "#/shared/lib/i18n/runtime";
import { useLocale } from "#/shared/lib/locales";
import { A11yRuntime } from "#/shared/ui/a11y-runtime";

import appCss from "#/app/styles/globals.css?url";

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`;

/** Router context. Route loaders read `context.queryClient` to prefetch queries. */
export type RouterContext = { queryClient: QueryClient };

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: env.VITE_APP_TITLE },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
  const locale = useLocale();
  return (
    <html lang={locale} dir={getTextDirection(locale)} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: A11Y_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        <ClientOnly>
          <A11yRuntime />
        </ClientOnly>
        <AuthCacheBoundary>{children}</AuthCacheBoundary>
        <Scripts />
      </body>
    </html>
  );
}
