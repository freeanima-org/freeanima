type ParaglideMessageFn = (
  inputs?: Record<string, unknown>,
  options?: { locale?: "en" | "zh-cn" },
) => string;

declare module "@paraglide/messages" {
  export const m: Record<string, ParaglideMessageFn>;
}

declare module "@paraglide/runtime" {
  export type Locale = "en" | "zh-cn";
  export const locales: readonly Locale[];
  export function getLocale(): Locale;
  export function setLocale(locale: Locale): void;
}

declare module "*/messages/paraglide/messages.js" {
  const messages: Record<string, ParaglideMessageFn>;
  export = messages;
}

declare module "*/messages/paraglide/runtime.js" {
  export type Locale = "en" | "zh-cn";
  export const locales: readonly Locale[];
  export function getLocale(): Locale;
  export function setLocale(locale: Locale): void;
}
