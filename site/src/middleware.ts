import { defineMiddleware } from "astro:middleware";

import { applySiteLocale } from "./lib/i18n.ts";
import { detectLocale } from "./lib/site.ts";

export const onRequest = defineMiddleware((context, next) => {
  applySiteLocale(detectLocale(context.url.pathname));
  return next();
});
