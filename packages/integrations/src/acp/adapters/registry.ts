import type { AcpAgentConfig } from "../status";
import { cursorAcpAdapter } from "./cursor";
import { genericAcpAdapter } from "./generic";
import type { AcpAgentAdapter } from "./types";

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
