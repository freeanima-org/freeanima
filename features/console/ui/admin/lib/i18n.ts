import { m } from "@paraglide/messages";
import { getLocale, locales, setLocale } from "@paraglide/runtime";

export type AdminLocale = (typeof locales)[number];

export { getLocale, locales, m, setLocale };

const LOCALE_KEY = "admin-locale";

export function getAdminLocale(): AdminLocale {
  try {
    const stored = localStorage.getItem(LOCALE_KEY);
    if (stored === "zh-cn" || stored === "en") return stored;
  } catch {
    /* ignore */
  }
  const lang = navigator.language.toLowerCase();
  return lang.startsWith("zh") ? "zh-cn" : "en";
}

export function setAdminLocale(locale: AdminLocale): void {
  setLocale(locale);
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    /* ignore */
  }
}

export function initAdminLocale(): AdminLocale {
  const locale = getAdminLocale();
  setLocale(locale);
  return locale;
}

export function toggleAdminLocale(): AdminLocale {
  const next = getLocale() === "zh-cn" ? "en" : "zh-cn";
  setAdminLocale(next);
  return next;
}
