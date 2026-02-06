import { useLocale } from "../contexts/LocaleContext";
import { translations, type Translations } from "../locales";

export function useTranslation(): Translations {
  const { locale } = useLocale();
  return translations[locale];
}
