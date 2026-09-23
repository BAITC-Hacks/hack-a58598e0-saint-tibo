import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { House, LogOut, Menu, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

import { authClient } from "#/shared/auth";
import { env } from "#/shared/config";
import { m } from "#/shared/lib/i18n/messages";
import type { Locale } from "#/shared/lib/i18n/runtime";
import { useLocale } from "#/shared/lib/locales";
import { A11yPanel } from "#/shared/ui/a11y-panel";
import LocaleSwitcher from "#/shared/ui/locale-switcher";
import { Button } from "#/shared/ui/shadcn/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "#/shared/ui/shadcn/sheet";
import ThemeToggle from "#/shared/ui/theme-toggle";

type NavigationItem = {
  to: "/";
  icon: LucideIcon;
  label: (locale: Locale) => string;
  exact?: boolean;
};

/** Add a page here and it appears in the sidebar, the mobile menu and the header title. */
const navigation: NavigationItem[] = [
  {
    to: "/",
    icon: House,
    label: (locale) => m.home_page({}, { locale }),
    exact: true,
  },
];

const linkClassName =
  "flex min-h-10 items-center gap-2 rounded-md px-3 text-muted-foreground text-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2";
const activeProps = {
  className: "bg-accent font-medium text-accent-foreground",
  "aria-current": "page",
} as const;

const Navigation = ({ onNavigate }: { onNavigate?: () => void }) => {
  const locale = useLocale();
  return (
    <nav
      aria-label={m.app_navigation({}, { locale })}
      className="grid gap-1 p-3"
    >
      {navigation.map(({ to, icon: Icon, label, exact }) => (
        <Link
          key={to}
          to={to}
          onClick={onNavigate}
          activeOptions={exact ? { exact: true } : undefined}
          className={linkClassName}
          activeProps={activeProps}
        >
          <Icon className="size-4" aria-hidden="true" />
          {label(locale)}
        </Link>
      ))}
    </nav>
  );
};

const useCurrentPageLabel = () => {
  const locale = useLocale();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const match = navigation
    .filter(
      (item) =>
        pathname === item.to || (!item.exact && pathname.startsWith(item.to))
    )
    .at(-1);
  return match?.label(locale) ?? m.home_page({}, { locale });
};

export const AppShell = ({ children }: { children: ReactNode }) => {
  const locale = useLocale();
  const { data: session } = authClient.useSession();
  const pageLabel = useCurrentPageLabel();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    setError(false);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message);
      await navigate({ to: "/login" });
    } catch {
      setError(true);
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:p-3 focus:outline-2"
      >
        {m.app_skip_content({}, { locale })}
      </a>
      <aside className="hidden w-56 shrink-0 border-e bg-sidebar lg:block">
        <div className="flex h-14 items-center border-b px-6 text-sm font-semibold">
          {env.VITE_APP_TITLE}
        </div>
        <Navigation />
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex min-h-14 flex-wrap items-center justify-between gap-2 border-b px-4 py-2 sm:px-6">
          <div className="flex items-center gap-2">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden"
                    aria-label={m.app_open_menu({}, { locale })}
                  />
                }
              >
                <Menu aria-hidden="true" />
              </SheetTrigger>
              <SheetContent
                side="left"
                showCloseButton={false}
                className="w-64 max-w-[calc(100%-2rem)] gap-0 overflow-y-auto overscroll-contain bg-sidebar"
              >
                <div className="flex min-h-14 items-center justify-between border-b px-4">
                  <SheetTitle>{env.VITE_APP_TITLE}</SheetTitle>
                  <SheetClose
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={m.app_close_menu({}, { locale })}
                      />
                    }
                  >
                    <X aria-hidden="true" />
                  </SheetClose>
                </div>
                <Navigation onNavigate={() => setMenuOpen(false)} />
              </SheetContent>
            </Sheet>
            <span className="text-sm text-muted-foreground">{pageLabel}</span>
          </div>
          <div className="flex max-w-full min-w-0 flex-wrap items-center gap-1">
            <LocaleSwitcher />
            <ThemeToggle />
            <A11yPanel />
            <span className="mx-2 hidden max-w-40 truncate text-sm lg:block">
              {session?.user.name}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label={m.auth_signout({}, { locale })}
              disabled={signingOut}
              onClick={() => {
                void signOut();
              }}
            >
              <LogOut aria-hidden="true" />
            </Button>
          </div>
        </header>
        {error && (
          <p role="alert" className="px-6 pt-4 text-sm text-destructive">
            {m.auth_network_error({}, { locale })}
          </p>
        )}
        <main id="main-content" tabIndex={-1} className="p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};
