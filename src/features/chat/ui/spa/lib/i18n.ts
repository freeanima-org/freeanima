import { m } from "@paraglide/messages";
import { getLocale, locales, setLocale } from "@paraglide/runtime";

export type AppLocale = (typeof locales)[number];

export { getLocale, locales, m, setLocale };

const LOCALE_KEY = "chat-locale";

export function getAppLocale(): AppLocale {
  try {
    const stored = localStorage.getItem(LOCALE_KEY);
    if (stored === "zh-cn" || stored === "en") return stored;
  } catch {
    /* ignore */
  }
  return navigator.language.toLowerCase().startsWith("zh") ? "zh-cn" : "en";
}

export function initAppLocale(): AppLocale {
  const locale = getAppLocale();
  void setLocale(locale);
  return locale;
}

export function toggleAppLocale(): AppLocale {
  const next = getAppLocale() === "zh-cn" ? "en" : "zh-cn";
  try {
    localStorage.setItem(LOCALE_KEY, next);
  } catch {
    /* ignore */
  }
  void setLocale(next);
  return next;
}
