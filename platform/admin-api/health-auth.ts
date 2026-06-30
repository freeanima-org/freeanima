import { ANIMA_REMOTE_ADDRESS_HEADER } from "./http-dispatch.ts";
import { evaluateServiceAuthAuthed } from "./service-auth.ts";
export { isHealthProbePath } from "./remote-auth.ts";

export function resolveRemoteAddressFromRequest(request: Request): string | undefined {
  return request.headers.get(ANIMA_REMOTE_ADDRESS_HEADER) ?? undefined;
}

/** GET /api/health 响应中的 authed：是否带有效 service API token */
export async function evaluateHealthAuthed(request: Request): Promise<boolean> {
  return evaluateServiceAuthAuthed(request);
}
