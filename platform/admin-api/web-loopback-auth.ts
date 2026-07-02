import { readLoopbackWebAuthTokenFromEnvOrFile } from "@freeanima/platform/config";

import { isLocalDirectConnection } from "./remote-auth.ts";

/** 仅 loopback 直连请求可读取 Hub 托管 Web UI 的 bootstrap token */
export function resolveLoopbackWebAuthTokenForRequest(
  req: Request,
  remoteAddress?: string,
): string | null {
  if (!isLocalDirectConnection(req, remoteAddress)) return null;
  return readLoopbackWebAuthTokenFromEnvOrFile();
}
