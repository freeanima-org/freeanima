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
import type { Kernel } from "@freeanima/kernel";
import { beforeLlmCall } from "@freeanima/kernel-hooks";
import type { ConversationService } from "@freeanima/engine-conversation";
import type { SemanticMemoryStorePort, SessionStorePort } from "@freeanima/engine-repos";
import { registerMemoryPipeline, registerMemoryTools } from "@freeanima/life-memory";
let toolsRegistered = false;

/** 注册全部本地/MCP 无关工具（幂等） */
export function registerServiceTools(): void {
  if (toolsRegistered) return;
  registerCoreTools();
  registerSupplementalTools();
  registerMemoryTools();
  registerSelfTools();
  registerClarifyTool();
  registerCronjobTool();
  registerWriteFridgeMagnetTool();
  registerTaskTools();
  toolsRegistered = true;
}

/** @deprecated 使用 registerServiceTools */
export function registerAllTools(): void {
  registerServiceTools();
}

/** 注册 clarify hook 与 ACP 工具（需 kernel + conversation） */
export function registerServiceIntegrations(opts: {
  kernel: Kernel;
  conversation: ConversationService;
  onSessionUpdated?: ((sid: string) => void) | null;
}): void {
  registerClarifyHooks({ kernel: opts.kernel, conversation: opts.conversation });
  const acp = getAcpManager();
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

/** 注册记忆 store 并启动 EventBus（session:updated 事件保留，无 reflect 订阅） */
export function registerServiceMemoryBus(opts: {
  kernel: Kernel;
  sessionStore: SessionStorePort;
  semanticStore: SemanticMemoryStorePort;
}): void {
  registerMemoryPipeline({
    bus: opts.kernel.eventBus,
    sessionStore: opts.sessionStore,
    semanticStore: opts.semanticStore,
  });
  opts.kernel.eventBus.start();
}
