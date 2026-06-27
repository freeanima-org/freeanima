import { m } from "@paraglide/messages";
import { setLocale } from "@paraglide/runtime";

import type { SiteLocale } from "./site.ts";

export { m };

export function applySiteLocale(locale: SiteLocale): void {
  setLocale(locale);
}

export function heroTitleLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function docsBasePath(locale: SiteLocale): string {
  return locale === "zh-cn" ? "/zh-cn/docs/" : "/docs/";
}
