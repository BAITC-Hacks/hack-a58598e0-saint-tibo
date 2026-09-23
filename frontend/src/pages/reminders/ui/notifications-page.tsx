import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { authClient } from "#/shared/auth";
import { useLocale } from "#/shared/lib/locales";
import { Button } from "#/shared/ui/shadcn/button";

import {
  ReminderLoadError,
  REMINDERS_PAGE_SIZE,
  REMINDERS_REFRESH_MS,
  remindersQuery,
} from "../api/reminders";
import { useRemindersCopy } from "../lib/copy";

export function NotificationsPage() {
  const t = useRemindersCopy();
  const locale = useLocale();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [offset, setOffset] = useState(0);
  const inbox = useQuery({
    ...remindersQuery(session?.session.id, offset),
    // The shell polls page zero even when this page is not mounted.
    refetchInterval: offset > 0 ? REMINDERS_REFRESH_MS : false,
    refetchIntervalInBackground: false,
  });
  const status = inbox.error instanceof ReminderLoadError ? inbox.error.status : 0;
  const signedOut = (!sessionPending && !session) || status === 401;
  const failed = inbox.isError || signedOut;
  const data = !failed && session ? inbox.data : undefined;
  const date = (value: string) => new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.help}</p>
        <p className="text-xs text-muted-foreground">{t.refreshHelp}</p>
      </header>
      <Button
        variant="outline"
        disabled={!session || inbox.isFetching}
        onClick={() => void inbox.refetch()}
      >
        {inbox.isFetching ? t.loading : t.refresh}
      </Button>
      {failed ? (
        <div role="alert" className="space-y-3 rounded-xl border border-destructive/40 p-5">
          <p>{signedOut ? t.signedOut : status === 403 ? t.forbidden : t.error}</p>
          {signedOut && <Link to="/login" className="text-primary underline">{t.signIn}</Link>}
        </div>
      ) : sessionPending || inbox.isPending ? (
        <output className="block rounded-xl border p-5">{t.loading}</output>
      ) : data && (
        <>
          <p className="text-sm text-muted-foreground">
            {t.total}: {data.total} · {t.evaluated}: {new Intl.DateTimeFormat(locale, {
              dateStyle: "medium", timeStyle: "short",
            }).format(new Date(data.evaluated_at))}
          </p>
          {data.items.length ? (
            <ul className="space-y-3">
              {data.items.map((item) => (
                <li key={item.id} className="space-y-2 rounded-xl border bg-card p-5">
                  <p className={item.kind === "overdue" ? "text-sm font-medium text-destructive" : "text-sm font-medium"}>
                    {item.kind === "overdue" ? t.overdue : t.upcoming}
                    {" · "}<time dateTime={item.due_date}>{date(item.due_date)}</time>
                    {" · "}{item.timezone}
                  </p>
                  <p className="whitespace-pre-wrap break-words">{item.text}</p>
                  <Link
                    to="/meetings/$meetingId"
                    params={{ meetingId: item.meeting_id }}
                    className="text-sm text-primary underline"
                  >
                    {t.openMeeting}: {item.meeting_title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="space-y-2 rounded-xl border p-5">
              <h2 className="font-medium">{t.empty}</h2>
              <p className="text-sm text-muted-foreground">
                {offset > 0 && data.total > 0 ? t.emptyPage : t.emptyHelp}
              </p>
            </div>
          )}
          {(offset > 0 || data.total > REMINDERS_PAGE_SIZE) && (
            <div className="flex items-center gap-3">
              <Button variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - REMINDERS_PAGE_SIZE))}>
                {t.previous}
              </Button>
              <Button variant="outline" disabled={offset + REMINDERS_PAGE_SIZE >= data.total} onClick={() => setOffset(offset + REMINDERS_PAGE_SIZE)}>
                {t.next}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
