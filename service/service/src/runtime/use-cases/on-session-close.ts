import { generateSessionHandoffSummary } from "@freeanima/engine-conversation";
import { getServiceContext } from "@freeanima/service-api";
import { logComponent } from "@freeanima/service-logging";

/** /new 等关闭旧 session 前：只读生成交接摘要（不写旧 session） */
export async function onSessionCloseBeforeNew(sessionId: string): Promise<string | null> {
  const { engine } = getServiceContext();
  const result = await generateSessionHandoffSummary(engine.repos, sessionId);
  if (result.ok) return result.summary;
  if (result.error !== "无对话内容") {
    logComponent("session-close").warn(`handoff 摘要失败: ${sessionId}`, { err: result.error });
  }
  return null;
}
