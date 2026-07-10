import {
  getHubMethodDef,
  resolveHubAuthPolicy,
  type HubMethod,
} from "@freeanima/shared/hub-contract";

import { findRoute, hubRestRelativePath } from "./http-rest-router.ts";

export function matchHubHttpRoute(
  req: Request,
): { hubMethod: HubMethod; authOptional: boolean } | null {
  const verb = req.method;
  if (verb !== "GET" && verb !== "POST") return null;

  const relativePath = hubRestRelativePath(new URL(req.url).pathname);
  if (relativePath === null) return null;

  const match = findRoute(verb, relativePath);
  if (!match) return null;

  const def = getHubMethodDef(match.entry.hubMethod);
  return {
    hubMethod: match.entry.hubMethod,
    authOptional: resolveHubAuthPolicy(def.meta) === "optional",
  };
}

export function isOptionalAuthHubHttpRequest(req: Request): boolean {
  return matchHubHttpRoute(req)?.authOptional === true;
}
