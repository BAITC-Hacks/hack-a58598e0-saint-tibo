import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";

import { mockModeKey } from "#/shared/api";
import { authClient } from "#/shared/auth";
import { useLocale } from "#/shared/lib/locales";
import { Button } from "#/shared/ui/shadcn/button";

const copy = {
  ru: {
    title: "Настройки",
    real: "Реальный backend",
    mock: "Демонстрационные данные",
    active: "Активен",
    connected: "Соединение есть",
    unavailable: "Недоступен",
    reset: "Сбросить демо-данные",
    unsaved: "Несохранённые правки будут потеряны. Продолжить?",
    error: "Не удалось подключиться",
  },
  kk: {
    title: "Баптаулар",
    real: "Нақты backend",
    mock: "Демонстрациялық деректер",
    active: "Белсенді",
    connected: "Қосылған",
    unavailable: "Қолжетімсіз",
    reset: "Демо деректерді қалпына келтіру",
    unsaved: "Сақталмаған өзгерістер жоғалады. Жалғастыру керек пе?",
    error: "Қосылу мүмкін болмады",
  },
  en: {
    title: "Settings",
    real: "Real backend",
    mock: "Demo data",
    active: "Active",
    connected: "Connected",
    unavailable: "Unavailable",
    reset: "Reset demo data",
    unsaved: "Unsaved changes will be lost. Continue?",
    error: "Connection failed",
  },
};
const modeStatus = z.object({
  mode: z.enum(["real", "mock"]),
  enabled: z.boolean(),
  realConnected: z.boolean(),
  mockConnected: z.boolean(),
});

function SettingsPage() {
  const t = copy[useLocale()];
  const { data: session } = authClient.useSession();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"real" | "mock">("real");
  const [enabled, setEnabled] = useState(false);
  const [connections, setConnections] = useState({ real: false, mock: false });
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch("/api/mock-mode", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return modeStatus.parse(await response.json());
      })
      .then((result) => {
        setMode(result.mode);
        setEnabled(result.enabled);
        setConnections({
          real: result.realConnected,
          mock: result.mockConnected,
        });
      })
      .catch(() => setEnabled(false));
  }, []);
  async function select(next: "real" | "mock") {
    if (next === mode || !window.confirm(t.unsaved)) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/mock-mode", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: next }),
      });
      if (!response.ok) throw new Error(t.error);
      if (session?.user.id)
        localStorage.setItem(mockModeKey(session.user.id), next);
      queryClient.clear();
      window.location.reload();
    } catch {
      setStatus(t.error);
      setBusy(false);
    }
  }
  async function reset() {
    if (!window.confirm(t.unsaved)) return;
    setBusy(true);
    try {
      const response = await fetch("/api/mock/api/v1/demo/reset", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error(t.error);
      if (session?.user.id)
        localStorage.removeItem(`saint-tibo-demo-access:${session.user.id}`);
      queryClient.clear();
      window.location.reload();
    } catch {
      setStatus(t.error);
      setBusy(false);
    }
  }
  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-semibold">{t.title}</h1>
      {(["real", "mock"] as const).map((item) => (
        <div key={item} className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">{item === "real" ? t.real : t.mock}</h2>
          <p className="text-sm text-muted-foreground">
            {item === "real"
              ? import.meta.env.VITE_API_URL
              : `${location.origin}/api/mock`}
          </p>
          <p className="my-2 text-sm">
            {item === mode ? `${t.active} · ` : ""}
            {connections[item] ? t.connected : t.unavailable}
          </p>
          <Button
            disabled={busy || (item === "mock" && !enabled) || item === mode}
            onClick={() => void select(item)}
          >
            {item === "real" ? t.real : t.mock}
          </Button>
        </div>
      ))}
      {mode === "mock" && (
        <Button variant="outline" disabled={busy} onClick={() => void reset()}>
          {t.reset}
        </Button>
      )}
      {status && (
        <p role="alert" className="text-destructive">
          {status}
        </p>
      )}
    </section>
  );
}

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});
