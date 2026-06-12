import * as m from "../../../../../messages/paraglide/messages.js";
import { getLocale, locales, setLocale } from "../../../../../messages/paraglide/runtime.js";

export type WebUiLocale = (typeof locales)[number];

export { getLocale, locales, m, setLocale };

const LOCALE_KEY = "webui-locale";

export function getWebUiLocale(): WebUiLocale {
  try {
    const stored = localStorage.getItem(LOCALE_KEY);
    if (stored === "zh-cn" || stored === "en") return stored;
  } catch {
    /* ignore */
  }
  const lang = navigator.language.toLowerCase();
  return lang.startsWith("zh") ? "zh-cn" : "en";
}

export function setWebUiLocale(locale: WebUiLocale): void {
  setLocale(locale);
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    /* ignore */
  }
}

export function initWebUiLocale(): WebUiLocale {
  const locale = getWebUiLocale();
  setLocale(locale);
  return locale;
}

export function toggleWebUiLocale(): WebUiLocale {
  const next = getLocale() === "zh-cn" ? "en" : "zh-cn";
  setWebUiLocale(next);
  return next;
}
