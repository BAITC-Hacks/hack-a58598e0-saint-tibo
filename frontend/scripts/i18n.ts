/**
 * Message catalogue helper.
 *
 *   bun run i18n:add <key> <ru> <kk> <en>   add one message to every locale
 *   bun run i18n:check                      fail when a locale is missing keys
 */
import { fileURLToPath } from "node:url";

import { z } from "zod";

const catalogueSchema = z.record(z.string(), z.string());
type Catalogue = z.infer<typeof catalogueSchema>;

const messagesDir = fileURLToPath(new URL("../messages/", import.meta.url));
const file = (locale: string) => `${messagesDir}${locale}.json`;

const { locales } = z
  .object({ locales: z.array(z.string()).min(1) })
  .parse(
    await Bun.file(
      fileURLToPath(new URL("../project.inlang/settings.json", import.meta.url))
    ).json()
  );

const read = async (locale: string): Promise<Catalogue> =>
  catalogueSchema.parse(await Bun.file(file(locale)).json());

const write = async (locale: string, catalogue: Catalogue) => {
  const { $schema, ...messages } = catalogue;
  const sorted = Object.fromEntries(
    Object.entries(messages).toSorted(([a], [b]) => a.localeCompare(b))
  );
  await Bun.write(
    file(locale),
    `${JSON.stringify({ $schema, ...sorted }, null, 2)}\n`
  );
};

const add = async (key: string, translations: string[]) => {
  if (!/^[a-z][a-z0-9_]*$/.test(key)) {
    throw new Error(`Message key must be snake_case: ${key}`);
  }
  if (translations.length !== locales.length) {
    throw new Error(
      `Provide one translation per locale, in order: ${locales.join(", ")}`
    );
  }
  for (const [index, locale] of locales.entries()) {
    const catalogue = await read(locale);
    catalogue[key] = translations[index] ?? "";
    await write(locale, catalogue);
  }
  process.stdout.write(`Added "${key}" to ${locales.join(", ")}.\n`);
};

const check = async () => {
  const catalogues = await Promise.all(locales.map(read));
  const known = new Set(
    catalogues.flatMap((catalogue) => Object.keys(catalogue))
  );
  const problems = locales.flatMap((locale, index) =>
    [...known]
      .filter((key) => !(key in (catalogues[index] ?? {})))
      .map((key) => `${locale}: missing "${key}"`)
  );
  if (problems.length > 0) {
    throw new Error(`Incomplete message catalogue.\n${problems.join("\n")}`);
  }
  process.stdout.write(
    `All ${known.size - 1} messages present in ${locales.join(", ")}.\n`
  );
};

const [command, key, ...translations] = process.argv.slice(2);
if (command === "add" && key !== undefined) {
  await add(key, translations);
} else if (command === "check") {
  await check();
} else {
  throw new Error("Usage: i18n.ts add <key> <ru> <kk> <en> | i18n.ts check");
}
