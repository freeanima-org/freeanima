import {
  getHabitatMethodDef,
  resolveHabitatAuthPolicy,
  type HabitatMethod,
} from "@freeanima/shared/habitat-contract";

import { findRoute, habitatRestRelativePath } from "./http-rest-router.ts";

export function matchHabitatHttpRoute(
  req: Request,
): { hubMethod: HabitatMethod; authOptional: boolean } | null {
  const verb = req.method;
  if (verb !== "GET" && verb !== "POST") return null;

  const relativePath = habitatRestRelativePath(new URL(req.url).pathname);
  if (relativePath === null) return null;

  const match = findRoute(verb, relativePath);
  if (!match) return null;

  const def = getHabitatMethodDef(match.entry.hubMethod);
  return {
    hubMethod: match.entry.hubMethod,
    authOptional: resolveHabitatAuthPolicy(def.meta) === "optional",
  };
}

export function isOptionalAuthHabitatHttpRequest(req: Request): boolean {
  return matchHabitatHttpRoute(req)?.authOptional === true;
}
