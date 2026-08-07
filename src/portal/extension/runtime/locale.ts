import { setLocale, type Locale } from "@paraglide/runtime";

function resolveExtensionLocale(): Locale {
  try {
    const lang = (
      typeof chrome !== "undefined" && chrome.i18n?.getUILanguage
        ? chrome.i18n.getUILanguage()
        : navigator.language
    ).toLowerCase();
    return lang.startsWith("zh") ? "zh-cn" : "en";
  } catch {
    return "zh-cn";
  }
}

/** 扩展 popup / options：按浏览器 UI 语言初始化 Paraglide */
export function initExtensionLocale(): void {
  void setLocale(resolveExtensionLocale(), { reload: false });
}
