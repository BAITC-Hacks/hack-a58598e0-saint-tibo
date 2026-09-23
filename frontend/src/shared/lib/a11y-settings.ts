import { useMemo, useSyncExternalStore } from "react";

export const A11Y_STORAGE_KEY = "saint_tibo:a11y";
export const FONT_SCALES = [1, 1.25, 1.5] as const;
export const IMAGE_MODES = ["normal", "grayscale", "hidden"] as const;
export type A11ySettings = {
  fontScale: (typeof FONT_SCALES)[number];
  contrast: boolean;
  scheme: "default" | "contrast";
  spacing: boolean;
  reduceMotion: boolean;
  images: (typeof IMAGE_MODES)[number];
  speech: boolean;
};
export const A11Y_DEFAULTS: A11ySettings = {
  fontScale: 1,
  contrast: false,
  scheme: "default",
  spacing: false,
  reduceMotion: false,
  images: "normal",
  speech: false,
};

export function parseA11ySettings(
  value: string | null,
  defaults = A11Y_DEFAULTS,
  scales = FONT_SCALES,
  imageModes = IMAGE_MODES
): A11ySettings {
  try {
    const data: unknown = JSON.parse(value ?? "null");
    if (!data || typeof data !== "object") return defaults;
    const field = (key: string): unknown => Reflect.get(data, key);
    return {
      fontScale: scales.find((scale) => scale === field("fontScale")) ?? 1,
      contrast: field("contrast") === true,
      scheme: field("scheme") === "contrast" ? "contrast" : "default",
      spacing: field("spacing") === true,
      reduceMotion: field("reduceMotion") === true,
      images: imageModes.find((mode) => mode === field("images")) ?? "normal",
      speech: field("speech") === true,
    };
  } catch {
    return defaults;
  }
}

export function applyA11ySettings(settings: A11ySettings, root: HTMLElement) {
  root.style.setProperty("--a11y-font-scale", String(settings.fontScale));
  root.classList.toggle("a11y-contrast", settings.contrast);
  root.classList.toggle("a11y-scheme-contrast", settings.scheme === "contrast");
  root.classList.toggle("a11y-spacing", settings.spacing);
  root.classList.toggle("a11y-no-motion", settings.reduceMotion);
  root.classList.toggle(
    "a11y-images-grayscale",
    settings.images === "grayscale"
  );
  root.classList.toggle("a11y-images-hidden", settings.images === "hidden");
}

let memory: string | null = null;
const read = (): string | null => {
  try {
    return memory ?? window.localStorage.getItem(A11Y_STORAGE_KEY);
  } catch {
    return memory;
  }
};
const subscribe = (listener: () => void) => {
  window.addEventListener(A11Y_STORAGE_KEY, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(A11Y_STORAGE_KEY, listener);
    window.removeEventListener("storage", listener);
  };
};
export const useA11ySettings = () => {
  const value = useSyncExternalStore(subscribe, read, () => null);
  return useMemo(() => parseA11ySettings(value), [value]);
};
export const updateA11ySettings = (patch: Partial<A11ySettings>) => {
  const next = { ...parseA11ySettings(read()), ...patch };
  memory = JSON.stringify(next);
  try {
    window.localStorage.setItem(A11Y_STORAGE_KEY, memory);
    memory = null;
  } catch {
    // Settings still work for this visit when storage is unavailable.
  }
  applyA11ySettings(next, document.documentElement);
  window.dispatchEvent(new Event(A11Y_STORAGE_KEY));
};

// Reuse the same parser and DOM application before paint; no duplicated settings logic.
export const A11Y_INIT_SCRIPT = `(()=>{try{const settings=(${parseA11ySettings.toString()})(localStorage.getItem(${JSON.stringify(A11Y_STORAGE_KEY)}),${JSON.stringify(A11Y_DEFAULTS)},${JSON.stringify(FONT_SCALES)},${JSON.stringify(IMAGE_MODES)});(${applyA11ySettings.toString()})(settings,document.documentElement)}catch{}})();`;
