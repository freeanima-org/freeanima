import { getAcpManager } from "@freeanima/capabilities-acp";
import { createAcpProgressDelivery } from "./acp-progress-delivery.ts";
import { registerClarifyHooks } from "@freeanima/capabilities-clarify";
import { registerClarifyTool } from "@freeanima/capabilities-clarify";
import {
  createFridgeMagnetHandler,
  registerWriteFridgeMagnetTool,
} from "@freeanima/capabilities-fridge-magnet";
import {
  createFridgeBridge,
  registerTaskTools,
  registerTasksModule,
} from "@freeanima/capabilities-tasks";
import { registerCoreTools, registerSupplementalTools } from "@freeanima/capabilities-tools";
import { registerCronjobTool } from "@freeanima/connectors-cron/cronjob-tool";
import { registerSelfTools } from "@freeanima/life-self";
import { registerEstateTools } from "@freeanima/life-estate";
import type { Kernel } from "@freeanima/kernel";
import { beforeLlmCall } from "@freeanima/kernel-hooks";
import type { ConversationService } from "@freeanima/engine-conversation";
import type { SemanticMemoryStorePort, SessionStorePort } from "@freeanima/engine-repos";
import type { SkillRegistry } from "@freeanima/engine-skill";
import type { ToolSetRegistry } from "@freeanima/engine-tool";
import { registerMemoryPipeline, registerMemoryTools } from "@freeanima/life-memory";
let registeredCatalog: { toolSets: ToolSetRegistry; skills: SkillRegistry } | null = null;

/** 注册全部本地/MCP 无关工具（幂等：同一 catalog 实例只注册一次） */
export function registerServiceTools(opts: {
  toolSets: ToolSetRegistry;
  skills: SkillRegistry;
}): void {
  if (registeredCatalog?.toolSets === opts.toolSets && registeredCatalog?.skills === opts.skills) {
    return;
  }
  registerCoreTools(opts.toolSets);
  registerSupplementalTools(opts.toolSets, opts.skills);
  registerMemoryTools(opts.toolSets);
  registerSelfTools(opts.toolSets);
  registerEstateTools(opts.toolSets);
  registerClarifyTool(opts.toolSets);
  registerCronjobTool(opts.toolSets);
  registerWriteFridgeMagnetTool(opts.toolSets);
  registerTaskTools(opts.toolSets);
  registeredCatalog = opts;
}

/** 单测 reset */
export function resetRegisterServiceToolsForTest(): void {
  registeredCatalog = null;
}

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

/** 注册冰箱贴 beforeLlmCall hook（Redis 须在组合根 initRedis 后可用） */
export function registerFridgeMagnet(opts: { kernel: Kernel }): void {
  opts.kernel.hookRegistry.on(beforeLlmCall, createFridgeMagnetHandler());
  registerTasksModule({ fridgeBridge: createFridgeBridge() });
}

/** 服务启动后启动 ACP 进度轮询 */
export function startAcpProgressTicker(): void {
  getAcpManager().startProgressTicker();
}

/** 注册记忆 store 并启动 EventBus */
export function registerServiceMemoryBus(opts: {
  kernel: Kernel;
  sessionStore: SessionStorePort;
  semanticStore: SemanticMemoryStorePort;
}): void {
  registerMemoryPipeline({
    sessionStore: opts.sessionStore,
    semanticStore: opts.semanticStore,
  });
  opts.kernel.eventBus.start();
}
