import { useLocale } from "#/shared/lib/locales";

import { en } from "./en";
import { kk } from "./kk";
import { ru } from "./ru";

export const useCopy = () => ({ ru, kk, en })[useLocale()];
