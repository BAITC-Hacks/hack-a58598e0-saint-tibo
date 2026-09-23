import { expect, test } from "bun:test";
import { runInNewContext } from "node:vm";

import {
  A11Y_DEFAULTS,
  A11Y_INIT_SCRIPT,
  parseA11ySettings,
} from "./a11y-settings";

test("invalid or obsolete saved preferences cannot break the interface", () => {
  for (const value of [null, "{", "null", "true", "17"]) {
    expect(parseA11ySettings(value)).toEqual(A11Y_DEFAULTS);
  }
  expect(
    parseA11ySettings(
      JSON.stringify({
        fontScale: 100,
        contrast: "true",
        images: "obsolete",
        scheme: "unknown",
        spacing: true,
      })
    )
  ).toEqual({ ...A11Y_DEFAULTS, spacing: true });
});

test("pre-paint script restores validated preferences without module globals", () => {
  const classes = new Set<string>();
  const styles = new Map<string, string>();
  const saved = {
    ...A11Y_DEFAULTS,
    fontScale: 1.5,
    scheme: "contrast",
    spacing: true,
  };
  runInNewContext(A11Y_INIT_SCRIPT, {
    localStorage: { getItem: () => JSON.stringify(saved) },
    document: {
      documentElement: {
        style: {
          setProperty: (key: string, value: string) => styles.set(key, value),
        },
        classList: {
          toggle: (key: string, enabled: boolean) =>
            enabled ? classes.add(key) : classes.delete(key),
        },
      },
    },
  });
  expect(styles.get("--a11y-font-scale")).toBe("1.5");
  expect([...classes]).toEqual(["a11y-scheme-contrast", "a11y-spacing"]);
});

test("pre-paint script tolerates blocked storage", () => {
  expect(() =>
    runInNewContext(A11Y_INIT_SCRIPT, {
      localStorage: {
        getItem: () => {
          throw new Error("Storage blocked");
        },
      },
    })
  ).not.toThrow();
});
