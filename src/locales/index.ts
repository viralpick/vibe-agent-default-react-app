import type { Translations } from "./types";
import { ko } from "./ko";
import { en } from "./en";

export type Locale = "ko" | "en";

export type { Translations } from "./types";

export const translations: Record<Locale, Translations> = {
  ko,
  en,
};

export { ko, en };
