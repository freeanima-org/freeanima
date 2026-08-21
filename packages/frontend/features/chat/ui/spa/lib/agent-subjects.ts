import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";
import { asRecord } from "@freeanima/shared/util";

export type AgentSubjectOption = {
  id: number;
  title: string;
};

let cached: AgentSubjectOption[] | null = null;
let inflight: Promise<AgentSubjectOption[]> | null = null;

function parseSubjectItems(raw: unknown): AgentSubjectOption[] {
  const rec = asRecord(raw);
  const items = rec?.items;
  if (!Array.isArray(items)) return [];
  const out: AgentSubjectOption[] = [];
  for (const row of items) {
    const r = asRecord(row);
    if (!r) continue;
    if (r.type !== "agent") continue;
    const id = typeof r.id === "number" ? r.id : Number(r.id);
    if (!Number.isInteger(id) || id <= 0) continue;
    const title = typeof r.title === "string" ? r.title.trim() : "";
    out.push({ id, title });
  }
  return out;
}

/** 拉取并缓存 type=agent 的 subject 列表（标题用于列表/会话头）。 */
export async function listAgentSubjects(opts?: { force?: boolean }): Promise<AgentSubjectOption[]> {
  if (!opts?.force && cached) return cached;
  if (!opts?.force && inflight) return inflight;
  inflight = (async () => {
    const raw = await getTypedHabitatClient().call("entity.subjectsList", { limit: 500 });
    cached = parseSubjectItems(raw);
    return cached;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** 展示名：title → 缓存 title → `#id` */
export function formatAgentSubjectLabel(
  agentSubjectId: number | undefined,
  agentTitle?: string | null,
  agents?: AgentSubjectOption[],
): string {
  const trimmed = agentTitle?.trim();
  if (trimmed) return trimmed;
  if (agentSubjectId == null) return "";
  const fromCache = agents?.find((a) => a.id === agentSubjectId)?.title.trim();
  if (fromCache) return fromCache;
  return `#${agentSubjectId}`;
}

export function resetAgentSubjectsCacheForTest(): void {
  cached = null;
  inflight = null;
}
