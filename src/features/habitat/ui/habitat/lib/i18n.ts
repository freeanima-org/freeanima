import { m } from "@paraglide/messages";
import { getLocale, locales, setLocale } from "@paraglide/runtime";

export type HabitatLocale = (typeof locales)[number];

export { getLocale, locales, m, setLocale };

const LOCALE_KEY = "console-locale";

export function getHabitatLocale(): HabitatLocale {
  try {
    const stored = localStorage.getItem(LOCALE_KEY);
    if (stored === "zh-cn" || stored === "en") return stored;
  } catch {
    /* ignore */
  }
  const lang = navigator.language.toLowerCase();
  return lang.startsWith("zh") ? "zh-cn" : "en";
}

export function setHabitatLocale(locale: HabitatLocale): void {
  setLocale(locale);
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    /* ignore */
  }
}

export function initHabitatLocale(): HabitatLocale {
  const locale = getHabitatLocale();
  setLocale(locale);
  return locale;
}

export function toggleHabitatLocale(): HabitatLocale {
  const next = getLocale() === "zh-cn" ? "en" : "zh-cn";
  setHabitatLocale(next);
  return next;
}
