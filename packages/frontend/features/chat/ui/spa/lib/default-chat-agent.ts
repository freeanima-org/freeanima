import { fetchHabitatConfigSection } from "@freeanima/client/portal-sdk/habitat-config-api.ts";
import { loadResolvedWorldContext } from "@freeanima/client/portal-sdk/world-context.ts";
import { asRecord } from "@freeanima/shared/util";

function positiveInt(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

/**
 * 解析新建会话默认 Anima：优先 worlds.context，其次 config chat.default_agent_subject_id。
 */
export async function resolveDefaultChatAgentSubjectId(): Promise<number | undefined> {
  try {
    const ctx = await loadResolvedWorldContext();
    const fromCtx = positiveInt(ctx.default_chat_agent_subject_id ?? ctx.agent_subject_id);
    if (fromCtx != null) return fromCtx;
  } catch {
    /* Habitat 未就绪时再试 config */
  }
  try {
    const section = await fetchHabitatConfigSection("chat");
    const rec = asRecord(section);
    return positiveInt(rec?.default_agent_subject_id);
  } catch {
    return undefined;
  }
}
