/** bundled 客户端（Electron / Capacitor / 本地 Web dev）跨 origin 访问 Hub REST */
import { FileConfig } from "@freeanima/platform/config";

const ALLOWED_ORIGIN = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$|^capacitor:\/\/localhost$/;

let extraOriginsCache: { origins: Set<string>; loadedAt: number } | null = null;
let testExtraOrigins: Set<string> | null = null;
const CACHE_MS = 5000;

function loadConfiguredWebOrigins(): Set<string> {
  if (testExtraOrigins) return testExtraOrigins;
  const now = Date.now();
  if (extraOriginsCache && now - extraOriginsCache.loadedAt < CACHE_MS) {
    return extraOriginsCache.origins;
  }
  const origins = new Set<string>();
  try {
    const data = FileConfig.open().data;
    const publicUrl = data.web?.public_url?.trim();
    if (publicUrl) {
      origins.add(new URL(publicUrl).origin);
    }
    const webHost = data.tunnel?.web_hostname?.trim();
    if (webHost) {
      origins.add(`https://${webHost}`);
      origins.add(`http://${webHost}`);
    }
  } catch {
    /* config unavailable */
  }
  extraOriginsCache = { origins, loadedAt: now };
  return origins;
}

/** 测试用：清除 CORS origin 缓存 */
export function resetCorsOriginCacheForTests(): void {
  extraOriginsCache = null;
  testExtraOrigins = null;
}

/** 测试用：注入额外允许的 origin */
export function setExtraCorsOriginsForTests(origins: string[] | null): void {
  testExtraOrigins = origins ? new Set(origins) : null;
  extraOriginsCache = null;
}

export function isBundledClientOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGIN.test(origin);
}

export function isAllowedWebOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (isBundledClientOrigin(origin)) return true;
  return loadConfiguredWebOrigins().has(origin);
}

export function corsAllowOrigin(origin: string | null): string | null {
  if (!origin || !isAllowedWebOrigin(origin)) return null;
  return origin;
}

type CorsHeaderBag = Record<string, string | number | undefined>;

export function applyCorsHeaders(headers: CorsHeaderBag, origin: string | null): void {
  const allowed = corsAllowOrigin(origin);
  if (!allowed) return;
  headers["Access-Control-Allow-Origin"] = allowed;
  headers["Access-Control-Allow-Credentials"] = "true";
  headers["Vary"] = "Origin";
}

export function corsPreflightResponse(origin: string | null): Response | null {
  const allowed = corsAllowOrigin(origin);
  if (!allowed) return null;
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": allowed,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-Requested-With, Accept, Cache-Control",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    },
  });
}
