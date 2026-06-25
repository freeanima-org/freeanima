import { ANIMA_REMOTE_ADDRESS_HEADER } from "./http-dispatch.ts";
import {
  evaluateRemoteAuthAuthed,
  isHealthProbePath,
  type RemoteAuthConfig,
} from "./remote-auth.ts";

export { isHealthProbePath };

export type HealthAuthContext = {
  remoteAuth?: RemoteAuthConfig;
};

export function resolveRemoteAddressFromRequest(request: Request): string | undefined {
  return request.headers.get(ANIMA_REMOTE_ADDRESS_HEADER) ?? undefined;
}

/** GET /api/health 响应中的 authed：后续 REST 是否会通过 remote_auth */
export function evaluateHealthAuthed(
  request: Request,
  remoteAddress: string | undefined,
  ctx: HealthAuthContext,
): boolean {
  return evaluateRemoteAuthAuthed(request, remoteAddress, ctx.remoteAuth?.token);
}
