declare module "@paraglide/runtime" {
  export type Locale = "en" | "zh-cn";
  export const locales: readonly Locale[];
  export function getLocale(): Locale;
  export function setLocale(locale: Locale): void;
}

declare module "*/messages/paraglide/runtime.js" {
  export type Locale = "en" | "zh-cn";
  export const locales: readonly Locale[];
  export function getLocale(): Locale;
  export function setLocale(locale: Locale): void;
}
