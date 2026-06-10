import { m } from "./i18n.ts";

export type SiteLocale = "en" | "zh-cn";

export const siteName = "Free Anima";
export const siteUrl = "https://freeanima.com";
export const githubUrl = "https://github.com/freeanima-org/freeanima";

export function getSiteMeta(): { siteTitle: string; siteDescription: string } {
  return {
    siteTitle: m.meta_title(),
    siteDescription: m.meta_description(),
  };
}

export function detectLocale(pathname: string): SiteLocale {
  const normalized = pathname.replace(/\/$/, "") || "/";
  if (normalized.startsWith("/zh-cn")) return "zh-cn";
  return "en";
}

export function getNavLinks(
  locale: SiteLocale,
): readonly ({ label: string; href: string } | { label: string; href: string; external: true })[] {
  const home = locale === "zh-cn" ? "/zh-cn/" : "/";
  const docs = locale === "zh-cn" ? "/zh-cn/docs/" : "/docs/";
  return [
    { label: m.nav_home(), href: home },
    { label: m.nav_docs(), href: docs },
    { label: m.nav_github(), href: githubUrl, external: true },
  ] as const;
}

export function getLanguageSwitch(pathname: string): { href: string; label: string } {
  if (pathname.startsWith("/zh-cn")) {
    return { href: "/", label: m.nav_language_en() };
  }
  return { href: "/zh-cn/", label: m.nav_language_zh() };
}
