/** bundled 客户端（Electron / Capacitor）跨 origin 访问 Hub REST */
const ALLOWED_ORIGIN = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$|^capacitor:\/\/localhost$/;

export function isBundledClientOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGIN.test(origin);
}

export function corsAllowOrigin(origin: string | null): string | null {
  if (!origin || !isBundledClientOrigin(origin)) return null;
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
