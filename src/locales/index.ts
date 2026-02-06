import type { Locale } from "../contexts/LocaleContext";
import type { Translations } from "./types";
import { ko } from "./ko";
import { en } from "./en";

export type { Translations } from "./types";

export const translations: Record<Locale, Translations> = {
  ko,
  en,
};

export { ko, en };
