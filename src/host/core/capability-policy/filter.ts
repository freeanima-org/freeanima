import type { ResolvedCapabilityPolicy } from "./types.ts";

export function checkTool(
  toolName: string,
  resolved: ResolvedCapabilityPolicy,
): { ok: true } | { ok: false; reason: string } {
  if (resolved.allowed_tools.includes(toolName)) {
    return { ok: true };
  }
  return { ok: false, reason: `Tool '${toolName}' is restricted by capability policy` };
}

export function filterToolNamesByPolicy(
  toolNames: readonly string[],
  resolved: ResolvedCapabilityPolicy,
): string[] {
  const allowed = new Set(resolved.allowed_tools);
  return toolNames.filter((name) => allowed.has(name));
}

export function runtimeToolPolicyFromResolved(
  resolved: ResolvedCapabilityPolicy | null,
): { allowedTools: readonly string[] } | undefined {
  if (!resolved) return undefined;
  return { allowedTools: resolved.allowed_tools };
}
