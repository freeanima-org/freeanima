import { isReflectEnabled } from "@freeanima/life-memory";
import { reflectSession } from "@freeanima/life-memory/reflect";

import { getServiceContext } from "../../context.ts";

/** /new 等关闭旧 session 前：可选 reflect 提取 L3 事实 */
export async function onSessionCloseBeforeNew(sessionId: string): Promise<void> {
  if (!isReflectEnabled()) return;
  try {
    const { conversation } = getServiceContext();
    await reflectSession(sessionId, conversation.repos.session);
  } catch {
    // 不阻塞关闭 session
  }
}
