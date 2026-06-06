import { distillFromPg } from "@freeanima/life-memory/clean";
import { isReflectEnabled } from "@freeanima/life-memory";
import { reflectSession } from "@freeanima/life-memory/reflect";

import { getServiceContext } from "../../context.ts";

/** /new 等关闭旧 session 前：L2 蒸馏 + 可选 reflect */
export async function onSessionCloseBeforeNew(sessionId: string): Promise<void> {
  try {
    const { conversation } = getServiceContext();
    const l2Path = await distillFromPg(conversation.repos.session, sessionId);
    if (l2Path && isReflectEnabled()) {
      await reflectSession(sessionId);
    }
  } catch {
    // 不阻塞关闭 session
  }
}
