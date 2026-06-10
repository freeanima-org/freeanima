declare module "*/messages/paraglide/messages.js" {
  const messages: Record<string, (inputs?: Record<string, unknown>) => string>;
  export = messages;
}

declare module "*/messages/paraglide/runtime.js" {
  export type Locale = "en" | "zh-cn";
  export const locales: readonly Locale[];
  export function getLocale(): Locale;
  export function setLocale(locale: Locale): void;
}
