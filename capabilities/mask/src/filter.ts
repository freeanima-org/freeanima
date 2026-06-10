import type { ResolvedMask } from "./types.ts";

export function checkTool(
  toolName: string,
  resolved: ResolvedMask,
): { ok: true } | { ok: false; reason: string } {
  if (resolved.allowed_tools.includes(toolName)) {
    return { ok: true };
  }
  return { ok: false, reason: `Tool '${toolName}' is restricted by capability mask` };
}

export function checkCredential(
  credName: string,
  mode: "read" | "write",
  resolved: ResolvedMask,
): { ok: true } | { ok: false; reason: string } {
  const perm = resolved.credentials.find((c) => c.name === credName);
  if (!perm) return { ok: true };
  if (perm[mode] === "deny") {
    return {
      ok: false,
      reason: `Credential '${credName}' ${mode} is restricted by capability mask`,
    };
  }
  return { ok: true };
}
