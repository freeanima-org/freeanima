import { m } from "@paraglide/messages";
import { getLocale, locales, setLocale } from "@paraglide/runtime";

export type ConsoleLocale = (typeof locales)[number];

export { getLocale, locales, m, setLocale };

const LOCALE_KEY = "console-locale";

export function getConsoleLocale(): ConsoleLocale {
  try {
    const stored = localStorage.getItem(LOCALE_KEY);
    if (stored === "zh-cn" || stored === "en") return stored;
  } catch {
    /* ignore */
  }
  const lang = navigator.language.toLowerCase();
  return lang.startsWith("zh") ? "zh-cn" : "en";
}

export function setConsoleLocale(locale: ConsoleLocale): void {
  setLocale(locale);
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    /* ignore */
  }
}

export function initConsoleLocale(): ConsoleLocale {
  const locale = getConsoleLocale();
  setLocale(locale);
  return locale;
}

export function toggleConsoleLocale(): ConsoleLocale {
  const next = getLocale() === "zh-cn" ? "en" : "zh-cn";
  setConsoleLocale(next);
  return next;
}
