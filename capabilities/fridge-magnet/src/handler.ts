import type { BeforeLlmCallContext } from "@freeanima/kernel-hooks";
import { scanSessionMagnets } from "./store.ts";
import { stripAllFromMessages, injectIntoMessages } from "./inject.ts";

export function createFridgeMagnetHandler() {
  return async (ctx: BeforeLlmCallContext): Promise<void> => {
    // 1. 从所有 user 消息中剪除旧的冰箱贴块（幂等——处理工具循环中的残留）
    stripAllFromMessages(ctx.messages);

    // 2. 检查最后一条消息是不是 user 消息
    const lastMsg = ctx.messages[ctx.messages.length - 1];
    if (!lastMsg || lastMsg.role !== "user") return; // 工具循环中——不注入

    // 3. 从 Redis 获取冰箱贴
    let magnets;
    try {
      magnets = await scanSessionMagnets(ctx.sessionId);
    } catch {
      return; // Redis 不可用时静默跳过
    }
    if (!magnets || magnets.length === 0) return;

    // 4. 注入到最后一条 user 消息
    injectIntoMessages(ctx.messages, magnets);
  };
}
