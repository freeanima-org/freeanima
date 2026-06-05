import type { AcpAgentConfig } from "../status.ts";
import { cursorAcpAdapter } from "./cursor.ts";
import { genericAcpAdapter } from "./generic.ts";
import type { AcpAgentAdapter } from "./types.ts";

const ADAPTERS: Record<string, AcpAgentAdapter> = {
  generic: genericAcpAdapter,
  cursor: cursorAcpAdapter,
};

export function resolveAcpAdapter(agentCfg: AcpAgentConfig): AcpAgentAdapter {
  const explicit = agentCfg.adapter?.trim().toLowerCase();
  if (explicit && ADAPTERS[explicit]) return ADAPTERS[explicit]!;

  const args = agentCfg.args ?? [];
  const cmd = (agentCfg.command ?? "").toLowerCase();
  if (args.includes("acp") || cmd.includes("agent")) {
    return cursorAcpAdapter;
  }

  return genericAcpAdapter;
}

export { genericAcpAdapter, cursorAcpAdapter };
