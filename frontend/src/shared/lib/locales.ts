import { useSyncExternalStore } from "react";

import { baseLocale, getLocale, setLocale } from "./i18n/runtime";
import type { Locale } from "./i18n/runtime";

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The prerendered SPA shell always uses the base locale. */
export const useLocale = () =>
  useSyncExternalStore<Locale>(subscribe, getLocale, () => baseLocale);

/** Cookie-only SPA: update subscribers without restarting routes or losing drafts. */
export const changeLocale = async (locale: Locale) => {
  if (getLocale() === locale) return;
  await setLocale(locale, { reload: false });
  for (const listener of listeners) listener();
};

export const localeLabels = {
  ru: { short: "RU", name: "Русский" },
  kk: { short: "KZ", name: "Қазақша" },
  en: { short: "EN", name: "English" },
} satisfies Record<Locale, { short: string; name: string }>;
