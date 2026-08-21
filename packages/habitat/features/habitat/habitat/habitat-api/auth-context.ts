import { isFullTokenAuthorization } from "@freeanima/shared/service-api-auth";
import type { VerifiedServiceApiToken } from "@freeanima/habitat/core/db/pg/service-api-token";

export type ServiceAuthContext = VerifiedServiceApiToken;

export function isFullServiceAuth(auth: ServiceAuthContext): boolean {
  return isFullTokenAuthorization(auth.authorization);
}

/** 历史名：仅表示是否为 full 授权 */
export function authHasScope(auth: ServiceAuthContext, _scope: string): boolean {
  return isFullServiceAuth(auth);
}
