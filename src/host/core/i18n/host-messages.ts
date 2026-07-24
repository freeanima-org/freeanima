import { readFileSync } from "node:fs";
import { join } from "node:path";

export type HostLocale = "en" | "zh-cn";

type Catalog = Record<string, string>;

const catalogs = new Map<HostLocale, Catalog>();

function loadCatalog(locale: HostLocale): Catalog {
  const cached = catalogs.get(locale);
  if (cached) return cached;
  const path = join(import.meta.dir, "../../../../messages/host", `${locale}.json`);
  const raw = JSON.parse(readFileSync(path, "utf-8")) as Catalog;
  catalogs.set(locale, raw);
  return raw;
}

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
  const catalog = loadCatalog(locale);
  const fallback = loadCatalog("en");
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
  catalogs.clear();
  activeLocale = "en";
  activeTimezone = "UTC";
}
