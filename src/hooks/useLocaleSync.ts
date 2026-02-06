import { useEffect } from "react";
import { useLocale, type Locale } from "../contexts/LocaleContext";

/**
 * PostMessage payload type for locale sync
 */
interface LocaleMessagePayload {
  type: "TOGGLE_EDIT_MODE";
  payload?: {
    locale?: Locale;
  };
}

/**
 * Type guard to check if the message is a valid locale message
 */
function isLocaleMessage(data: unknown): data is LocaleMessagePayload {
  if (!data || typeof data !== "object") return false;
  const msg = data as Record<string, unknown>;
  return msg.type === "TOGGLE_EDIT_MODE";
}

/**
 * Hook to sync locale from parent window via postMessage.
 * Listens for TOGGLE_EDIT_MODE messages and updates locale accordingly.
 */
export function useLocaleSync(): void {
  const { setLocale } = useLocale();

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { data } = event;

      if (!isLocaleMessage(data)) {
        return;
      }

      const locale = data.payload?.locale;
      if (locale === "ko" || locale === "en") {
        console.log("[useLocaleSync] Locale updated:", locale);
        setLocale(locale);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [setLocale]);
}
