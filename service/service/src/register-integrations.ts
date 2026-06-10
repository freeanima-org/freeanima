import { createFridgeMagnetHandler } from "@freeanima/capabilities-fridge-magnet";
import { getAcpManager } from "@freeanima/capabilities-acp";
import { registerClarifyHooks } from "@freeanima/capabilities-clarify";
import { createAcpProgressDelivery } from "./acp-progress-delivery.ts";
import type { Kernel } from "@freeanima/kernel";
import { beforeLlmCall } from "@freeanima/kernel-hooks";
import type { ConversationService } from "@freeanima/engine-conversation";
import type { SkillRegistry } from "@freeanima/engine-skill";
import type { ToolSetRegistry } from "@freeanima/engine-tool";

/** 注册 clarify hook 与 ACP 工具（需 kernel + conversation） */
export function registerServiceIntegrations(opts: {
  kernel: Kernel;
  conversation: ConversationService;
  toolSets: ToolSetRegistry;
  skills: SkillRegistry;
  onSessionUpdated?: ((sid: string) => void) | null;
}): void {
  registerClarifyHooks({ kernel: opts.kernel, conversation: opts.conversation });
  const acp = getAcpManager();
  acp.wireRegistries({ toolSets: opts.toolSets, skills: opts.skills });
  acp.wireConversation(opts.conversation);
  acp.wireProgressDelivery(
    createAcpProgressDelivery({
      conversation: opts.conversation,
      bus: opts.kernel.eventBus,
      onSessionUpdated: opts.onSessionUpdated ?? null,
    }),
  );
  acp.registerTools();
}

/** 注册冰箱贴 beforeLlmCall hook（FridgeStore 须在组合根 registerFridgeStore 后可用） */
export function registerFridgeMagnet(opts: { kernel: Kernel }): void {
  opts.kernel.hookRegistry.on(beforeLlmCall, createFridgeMagnetHandler());
}

/** 服务启动后启动 ACP 进度轮询 */
export function startAcpProgressTicker(): void {
  getAcpManager().startProgressTicker();
}
