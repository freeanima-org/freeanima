import type { ResolvedMask } from "./types.ts";

export function checkTool(
  toolName: string,
  resolved: ResolvedMask,
): { ok: true } | { ok: false; reason: string } {
  if (resolved.allowed_tools.includes(toolName)) {
    return { ok: true };
  }
  return { ok: false, reason: `工具 '${toolName}' 被能力面罩限制` };
}

export function checkCredential(
  credName: string,
  mode: "read" | "write",
  resolved: ResolvedMask,
): { ok: true } | { ok: false; reason: string } {
  const perm = resolved.credentials.find((c) => c.name === credName);
  if (!perm) return { ok: true };
  if (perm[mode] === "deny") {
    return { ok: false, reason: `凭证 '${credName}' 的 ${mode} 被能力面罩限制` };
  }
  return { ok: true };
}
