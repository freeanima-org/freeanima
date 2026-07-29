import enCatalog from "../../../../messages/host/en.json" with { type: "json" };
import zhCnCatalog from "../../../../messages/host/zh-cn.json" with { type: "json" };

export type HostLocale = "en" | "zh-cn";

type Catalog = Record<string, string>;

const CATALOGS: Record<HostLocale, Catalog> = {
  en: enCatalog as Catalog,
  "zh-cn": zhCnCatalog as Catalog,
};

let activeLocale: HostLocale = "en";
let activeTimezone = "UTC";

/** 从全局配置应用 locale / timezone */
export function applyHostI18nConfig(opts: {
  locale?: string | undefined;
  timezone?: string | undefined;
}): void {
  if (opts.locale === "en" || opts.locale === "zh-cn") {
    activeLocale = opts.locale;
  }
  if (opts.timezone && opts.timezone.trim()) {
    activeTimezone = opts.timezone.trim();
  }
}

export function getHostLocale(): HostLocale {
  return activeLocale;
}

export function getHostTimezone(): string {
  return activeTimezone;
}

/** Host catalog 文案（提示词片段、错误信息等） */
export function hostMsg(
  key: string,
  vars?: Record<string, string | number>,
  locale: HostLocale = activeLocale,
): string {
  const catalog = CATALOGS[locale];
  const fallback = CATALOGS.en;
  let text = catalog[key] ?? fallback[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

/** @internal 测试重置 */
export function resetHostI18nForTests(): void {
  activeLocale = "en";
  activeTimezone = "UTC";
}
