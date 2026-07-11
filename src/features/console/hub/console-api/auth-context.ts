import type { VerifiedServiceApiToken } from "@freeanima/core/db/pg/service-api-token";

export type ServiceAuthContext = VerifiedServiceApiToken;

export function authHasScope(auth: ServiceAuthContext, scope: string): boolean {
  return auth.scopes.includes("full") || auth.scopes.includes(scope);
}
