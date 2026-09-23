import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import type { FormEvent } from "react";

import { authClient } from "#/shared/auth";
import { m } from "#/shared/lib/i18n/messages";
import { useLocale } from "#/shared/lib/locales";
import { A11yPanel } from "#/shared/ui/a11y-panel";
import { BrandLockup } from "#/shared/ui/brand-lockup";
import LocaleSwitcher from "#/shared/ui/locale-switcher";
import { Button } from "#/shared/ui/shadcn/button";
import { Input } from "#/shared/ui/shadcn/input";
import ThemeToggle from "#/shared/ui/theme-toggle";

const authErrors = {
  auth_signup_error: m.auth_signup_error,
  auth_signin_error: m.auth_signin_error,
  auth_network_error: m.auth_network_error,
};

export const LoginPage = () => {
  const locale = useLocale();
  const { data: session, isPending } = authClient.useSession();
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  const destination = search.redirect ?? "/";
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<keyof typeof authErrors | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = form.get("email");
    const password = form.get("password");
    const name = form.get("name");
    if (typeof email !== "string" || typeof password !== "string") return;
    setError(null);
    setLoading(true);
    try {
      const result = isSignUp
        ? await authClient.signUp.email({
            email,
            password,
            name: typeof name === "string" ? name : "",
          })
        : await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(isSignUp ? "auth_signup_error" : "auth_signin_error");
        return;
      }
      await navigate({ href: destination });
    } catch {
      setError("auth_network_error");
    } finally {
      setLoading(false);
    }
  };
  const signOut = async () => {
    setError(null);
    try {
      const result = await authClient.signOut();
      if (result.error) setError("auth_network_error");
    } catch {
      setError("auth_network_error");
    }
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="brand-header flex min-h-16 flex-wrap items-center gap-3 px-4 py-2 sm:px-5">
        <BrandLockup />
        <div className="ml-auto flex max-w-full min-w-0 flex-wrap items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
          <A11yPanel />
        </div>
      </header>
      <div className="h-[3px] bg-brand-gold" aria-hidden="true" />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm rounded-[2px] border border-border bg-card p-5 shadow-[0_8px_24px_rgba(23,51,93,0.08)] sm:p-7">
          {isPending ? (
            <output>{m.auth_loading({}, { locale })}</output>
          ) : session?.user ? (
            <section className="space-y-6">
              <h1 className="text-2xl font-semibold tracking-tight">
                {m.auth_welcome({}, { locale })}
              </h1>
              <p>
                {m.auth_signed_in({ email: session.user.email }, { locale })}
              </p>
              <Button nativeButton={false} render={<Link to={destination} />}>
                {m.auth_continue({}, { locale })}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void signOut();
                }}
              >
                {m.auth_signout({}, { locale })}
              </Button>
            </section>
          ) : (
            <section>
              <h1 className="mb-2 text-2xl font-semibold tracking-tight">
                {isSignUp
                  ? m.auth_signup({}, { locale })
                  : m.auth_signin({}, { locale })}
              </h1>
              <p className="mb-6 text-sm text-muted-foreground">
                {isSignUp
                  ? m.auth_signup_description({}, { locale })
                  : m.auth_signin_description({}, { locale })}
              </p>
              <form
                onSubmit={(event) => {
                  void handleSubmit(event);
                }}
                className="space-y-4"
              >
                {isSignUp && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="name">
                      {m.auth_name({}, { locale })}
                    </label>
                    <Input id="name" name="name" autoComplete="name" required />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="email">
                    {m.auth_email({}, { locale })}
                  </label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="password">
                    {m.auth_password({}, { locale })}
                  </label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete={
                      isSignUp ? "new-password" : "current-password"
                    }
                    required
                    minLength={isSignUp ? 8 : undefined}
                    maxLength={128}
                    aria-describedby={isSignUp ? "password-help" : undefined}
                  />
                  {isSignUp && (
                    <p
                      id="password-help"
                      className="text-sm text-muted-foreground"
                    >
                      {m.auth_password_help({}, { locale })}
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-auto min-h-9 w-full py-2 whitespace-normal"
                >
                  {loading
                    ? m.auth_loading({}, { locale })
                    : isSignUp
                      ? m.auth_signup({}, { locale })
                      : m.auth_signin({}, { locale })}
                </Button>
              </form>
              <Button
                type="button"
                variant="ghost"
                className="mt-4 h-auto min-h-9 w-full whitespace-normal"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError(null);
                }}
              >
                {isSignUp
                  ? m.auth_switch_signin({}, { locale })
                  : m.auth_switch_signup({}, { locale })}
              </Button>
            </section>
          )}
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error && authErrors[error]({}, { locale })}
          </p>
        </div>
      </main>
    </div>
  );
};
