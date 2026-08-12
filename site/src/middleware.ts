import { defineMiddleware } from "astro:middleware";

/** 旧 /zh-cn/* 去掉前缀（非 i18n）；文档迁移见 doc-redirects */
export const onRequest = defineMiddleware((context, next) => {
  const { pathname } = context.url;
  if (pathname === "/zh-cn" || pathname === "/zh-cn/") {
    return context.redirect("/", 301);
  }
  if (pathname.startsWith("/zh-cn/")) {
    const stripped = pathname.slice("/zh-cn".length) || "/";
    return context.redirect(stripped + context.url.search, 301);
  }
  return next();
});
