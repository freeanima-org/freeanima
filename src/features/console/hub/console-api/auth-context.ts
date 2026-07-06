import type { VerifiedServiceApiToken } from "@freeanima/core/db/pg/service-api-token";

export type ServiceAuthContext = VerifiedServiceApiToken;

export const ANIMA_AUTH_SUBJECT_ID_HEADER = "x-anima-auth-subject-id";
export const ANIMA_AUTH_SUBJECT_TYPE_HEADER = "x-anima-auth-subject-type";
export const ANIMA_AUTH_TOKEN_ID_HEADER = "x-anima-auth-token-id";
export const ANIMA_AUTH_SCOPES_HEADER = "x-anima-auth-scopes";

export function attachServiceAuthToRequest(req: Request, auth: ServiceAuthContext): Request {
  const headers = new Headers(req.headers);
  headers.set(ANIMA_AUTH_SUBJECT_ID_HEADER, String(auth.subject_id));
  headers.set(ANIMA_AUTH_SUBJECT_TYPE_HEADER, auth.subject_type);
  headers.set(ANIMA_AUTH_TOKEN_ID_HEADER, String(auth.token_id));
  headers.set(ANIMA_AUTH_SCOPES_HEADER, auth.scopes.join(","));
  return new Request(req, { headers });
}

export function parseServiceAuthFromRequest(request: Request): ServiceAuthContext | null {
  const subjectIdRaw = request.headers.get(ANIMA_AUTH_SUBJECT_ID_HEADER);
  const subjectType = request.headers.get(ANIMA_AUTH_SUBJECT_TYPE_HEADER);
  const tokenIdRaw = request.headers.get(ANIMA_AUTH_TOKEN_ID_HEADER);
  const scopesRaw = request.headers.get(ANIMA_AUTH_SCOPES_HEADER);
  if (!subjectIdRaw || !subjectType || !tokenIdRaw) return null;
  if (subjectType !== "user" && subjectType !== "agent") return null;
  const subject_id = Number(subjectIdRaw);
  const token_id = Number(tokenIdRaw);
  if (!Number.isInteger(subject_id) || subject_id <= 0) return null;
  if (!Number.isInteger(token_id) || token_id <= 0) return null;
  const scopes = scopesRaw
    ? scopesRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : ["full"];
  return { subject_id, subject_type: subjectType, token_id, scopes };
}

export function requireServiceAuth(request: Request): ServiceAuthContext {
  const auth = parseServiceAuthFromRequest(request);
  if (!auth) {
    throw new Error("ServiceAuthContext missing on request");
  }
  return auth;
}

export function authHasScope(auth: ServiceAuthContext, scope: string): boolean {
  return auth.scopes.includes("full") || auth.scopes.includes(scope);
}
