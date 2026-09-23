import { ClientOnly } from "@tanstack/react-router";
import { Moon, Sun, Monitor } from "lucide-react";
import { useEffect, useState } from "react";

import { m } from "#/shared/lib/i18n/messages";
import { useLocale } from "#/shared/lib/locales";

import { Button } from "./shadcn/button";

type ThemeMode = "light" | "dark" | "auto";

function getInitialMode(): ThemeMode {
  if (typeof window === "undefined") {
    return "auto";
  }

  try {
    const stored = window.localStorage.getItem("theme");
    if (stored === "light" || stored === "dark" || stored === "auto") {
      return stored;
    }
  } catch {
    // Browsers may block storage; system appearance remains available.
  }

  return "auto";
}

function applyThemeMode(mode: ThemeMode) {
  const style = document.createElement("style");
  style.textContent = "*,*::before,*::after{transition:none!important}";
  document.head.append(style);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = mode === "auto" ? (prefersDark ? "dark" : "light") : mode;

  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(resolved);

  if (mode === "auto") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = mode;
  }

  document.documentElement.style.colorScheme = resolved;
  // Flush the theme before restoring interactive transitions.
  void window.getComputedStyle(document.body).opacity;
  requestAnimationFrame(() => style.remove());
}

function ThemeToggleContent() {
  const locale = useLocale();
  const [mode, setMode] = useState<ThemeMode>(getInitialMode);

  useEffect(() => {
    applyThemeMode(mode);
  }, [mode]);

  useEffect(() => {
    if (mode !== "auto") {
      return undefined;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      applyThemeMode("auto");
    };

    media.addEventListener("change", onChange);
    return () => {
      media.removeEventListener("change", onChange);
    };
  }, [mode]);

  function toggleMode() {
    const nextMode: ThemeMode =
      mode === "light" ? "dark" : mode === "dark" ? "auto" : "light";
    setMode(nextMode);
    try {
      window.localStorage.setItem("theme", nextMode);
    } catch {
      // Keep the selected appearance for this visit.
    }
  }

  const modeLabel =
    mode === "auto"
      ? m.app_theme_auto({}, { locale })
      : mode === "dark"
        ? m.app_theme_dark({}, { locale })
        : m.app_theme_light({}, { locale });
  const label = m.app_theme_label({ mode: modeLabel }, { locale });

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleMode}
      aria-label={label}
      title={label}
    >
      {mode === "auto" ? (
        <Monitor aria-hidden="true" />
      ) : mode === "dark" ? (
        <Moon aria-hidden="true" />
      ) : (
        <Sun aria-hidden="true" />
      )}
    </Button>
  );
}

export default function ThemeToggle() {
  return (
    <ClientOnly>
      <ThemeToggleContent />
    </ClientOnly>
  );
}
