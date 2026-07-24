import type { CredentialPermission, Mask, ResolvedMask } from "./types.ts";
import type { ToolSetRegistry } from "@freeanima/host/core/tool";
import { expandToolSets } from "./expand.ts";

type PermLevel = CredentialPermission["read"];

function strictestPerm(a: PermLevel, b: PermLevel): PermLevel {
  if (a === "deny" || b === "deny") return "deny";
  if (a === "allow" || b === "allow") return "allow";
  return null;
}

function mergeCredentials(all: CredentialPermission[]): CredentialPermission[] {
  const byName = new Map<string, CredentialPermission>();
  for (const cred of all) {
    const name = cred.name.trim();
    if (!name) continue;
    const prev = byName.get(name);
    if (!prev) {
      byName.set(name, { name, read: cred.read, write: cred.write });
      continue;
    }
    byName.set(name, {
      name,
      read: strictestPerm(prev.read, cred.read),
      write: strictestPerm(prev.write, cred.write),
    });
  }
  return [...byName.values()];
}

/** Merge multiple expanded masks (allow union − deny union) */
export function mergeMaskChain(
  chain: readonly Mask[],
  toolSetRegistry: ToolSetRegistry,
): ResolvedMask {
  const allowedRaw: string[] = [];
  const deniedRaw: string[] = [];
  const autoSkills: string[] = [];
  const credentials: CredentialPermission[] = [];

  for (const mask of chain) {
    allowedRaw.push(...mask.allowed_tools);
    deniedRaw.push(...mask.denied_tools);
    autoSkills.push(...mask.auto_skills);
    credentials.push(...mask.credentials);
  }

  const allowedExpanded = new Set(expandToolSets(allowedRaw, toolSetRegistry));
  const deniedExpanded = new Set(expandToolSets(deniedRaw, toolSetRegistry));
  for (const name of deniedExpanded) {
    allowedExpanded.delete(name);
  }

  return {
    allowed_tools: [...allowedExpanded].toSorted(),
    denied_tools: [...deniedExpanded].toSorted(),
    auto_skills: [...new Set(autoSkills)].toSorted(),
    credentials: mergeCredentials(credentials),
  };
}
