import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  House,
  ListTodo,
  LogOut,
  Menu,
  MessageCircleQuestion,
  NotebookTabs,
  Shield,
  Settings,
  UserRound,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

import { isMockApi } from "#/shared/api/backend-client";
import { authClient, useAccess } from "#/shared/auth";
import { m } from "#/shared/lib/i18n/messages";
import type { Locale } from "#/shared/lib/i18n/runtime";
import { useLocale } from "#/shared/lib/locales";
import { A11yPanel } from "#/shared/ui/a11y-panel";
import { BrandLockup } from "#/shared/ui/brand-lockup";
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
  to: string;
  icon: LucideIcon;
  label: (locale: Locale) => string;
  permission?: "users:read" | "access:read";
};

const navigation: NavigationItem[] = [
  { to: "/", icon: House, label: (locale) => m.nav_today({}, { locale }) },
  {
    to: "/meetings",
    icon: NotebookTabs,
    label: (locale) => m.nav_meetings({}, { locale }),
  },
  {
    to: "/calendar",
    icon: CalendarDays,
    label: (locale) => m.nav_calendar({}, { locale }),
  },
  {
    to: "/agenda",
    icon: ClipboardList,
    label: (locale) => m.nav_agenda({}, { locale }),
  },
  {
    to: "/tasks",
    icon: ListTodo,
    label: (locale) => m.nav_tasks({}, { locale }),
  },
  {
    to: "/analytics",
    icon: BarChart3,
    label: (locale) => m.nav_analytics({}, { locale }),
  },
  {
    to: "/people",
    icon: Users,
    label: (locale) => m.nav_people({}, { locale }),
  },
  {
    to: "/briefing",
    icon: ClipboardList,
    label: (locale) => m.nav_briefing({}, { locale }),
  },
  {
    to: "/ask",
    icon: MessageCircleQuestion,
    label: (locale) => m.nav_ask({}, { locale }),
  },
  {
    to: "/profile",
    icon: UserRound,
    label: (locale) => m.nav_profile({}, { locale }),
  },
  {
    to: "/settings",
    icon: Settings,
    label: (locale) =>
      ({ ru: "Настройки", kk: "Баптаулар", en: "Settings" })[locale],
  },
  {
    to: "/admin/users",
    icon: Shield,
    label: (locale) => m.nav_admin_users({}, { locale }),
    permission: "users:read",
  },
  {
    to: "/admin/people",
    icon: Users,
    label: (locale) => m.nav_admin_people({}, { locale }),
    permission: "access:read",
  },
  {
    to: "/admin/access",
    icon: Shield,
    label: (locale) => m.nav_admin_access({}, { locale }),
    permission: "access:read",
  },
];

const Navigation = ({ onNavigate }: { onNavigate?: () => void }) => {
  const locale = useLocale();
  const { can } = useAccess();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <nav
      aria-label={m.app_navigation({}, { locale })}
      className="flex flex-col py-4"
    >
      {navigation
        .filter(({ permission }) => !permission || can(permission))
        .map(({ to, icon: Icon, label }) => {
          const active =
            pathname === to || (to !== "/" && pathname.startsWith(`${to}/`));
          return (
            <a
              key={to}
              href={to}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className="flex min-h-10 items-center gap-2.5 border-l-[3px] border-transparent px-[18px] py-2 text-[15px] text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:bg-sidebar-accent focus-visible:text-sidebar-accent-foreground aria-[current=page]:border-brand-gold aria-[current=page]:bg-white/10 aria-[current=page]:font-bold aria-[current=page]:text-white"
            >
              <Icon
                className="size-4 shrink-0 text-brand-gold"
                aria-hidden="true"
              />
              {label(locale)}
            </a>
          );
        })}
    </nav>
  );
};

export const AppShell = ({ children }: { children: ReactNode }) => {
  const locale = useLocale();
  const { data: session } = authClient.useSession();
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
    <div className="min-h-dvh bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:bg-card focus:p-3"
      >
        {m.app_skip_content({}, { locale })}
      </a>
      <header className="brand-header flex min-h-16 flex-wrap items-center gap-3 px-4 py-2 sm:px-5">
        <BrandLockup />
        <div className="ml-auto flex max-w-full min-w-0 flex-wrap items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
          <A11yPanel />
          <span className="mx-2 hidden max-w-40 truncate text-[13px] font-bold text-brand-navy lg:block">
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
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="min-[1101px]:hidden"
                  aria-label={m.app_open_menu({}, { locale })}
                />
              }
            >
              <Menu aria-hidden="true" />
            </SheetTrigger>
            <SheetContent
              side="left"
              showCloseButton={false}
              className="w-[min(288px,calc(100%-2rem))] gap-0 overflow-y-auto border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
            >
              <div className="flex min-h-16 items-center justify-between border-b border-sidebar-border px-4">
                <SheetTitle className="text-sidebar-foreground">
                  Хаттама
                </SheetTitle>
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
        </div>
      </header>
      <div className="h-[3px] bg-brand-gold" aria-hidden="true" />
      {isMockApi() && (
        <div className="bg-amber-100 px-4 py-1 text-center text-sm font-semibold text-amber-950">
          {
            {
              ru: "Синтетические данные",
              kk: "Синтетикалық деректер",
              en: "Synthetic data",
            }[locale]
          }
        </div>
      )}
      <div className="flex min-h-[calc(100dvh-67px)]">
        <aside className="hidden w-[228px] shrink-0 flex-col bg-sidebar text-sidebar-foreground min-[1101px]:flex">
          <Navigation />
          <div className="mt-auto flex items-center gap-2.5 border-t border-sidebar-border px-[18px] py-3">
            <img src="/brand-bird.svg" alt="" className="h-7 w-[18px]" />
            <small className="text-[11px] leading-[1.3] text-sidebar-foreground">
              Хаттама
            </small>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          {error && (
            <p role="alert" className="px-5 pt-4 text-sm text-destructive">
              {m.auth_network_error({}, { locale })}
            </p>
          )}
          <main
            id="main-content"
            tabIndex={-1}
            className="px-3 py-3.5 sm:p-[18px] lg:px-[22px]"
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};
