import type { AccessJwtVerifier } from "./access-jwt.ts";
import type { RemoteAuthVerifier } from "./remote-auth.ts";

/** Bun requestIP 注入，供 /api/echo 等调试接口展示真实 TCP 来源 */
export const ANIMA_REMOTE_ADDRESS_HEADER = "x-anima-remote-address";

export function attachRemoteAddressToRequest(
  req: Request,
  remoteAddress: string | undefined,
): Request {
  if (!remoteAddress) return req;
  const headers = new Headers(req.headers);
  headers.set(ANIMA_REMOTE_ADDRESS_HEADER, remoteAddress);
  return new Request(req, { headers });
}

/** REST API 路径（须先过 remote_auth / Access 中间件） */
export function isHubApiPath(pathname: string): boolean {
  return pathname === "/" || pathname === "/api" || pathname.startsWith("/api/");
}

export async function applyHttpAuth(
  req: Request,
  remoteAddress: string | undefined,
  remoteAuth: RemoteAuthVerifier | null,
  accessJwt: AccessJwtVerifier | null,
): Promise<Response | null> {
  if (remoteAuth) {
    const blocked = await remoteAuth.verifyRequest(req, remoteAddress);
    if (blocked) return blocked;
  }
  if (accessJwt) {
    const blocked = await accessJwt.verifyRequest(req, remoteAddress);
    if (blocked) return blocked;
  }
  return null;
}
