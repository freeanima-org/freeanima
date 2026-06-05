import { getAcpManager } from "@freeanima/capabilities-acp";
import { registerClarifyHooks } from "@freeanima/capabilities-clarify";
import { registerClarifyTool } from "@freeanima/capabilities-clarify";
import { registerCoreTools, registerSupplementalTools } from "@freeanima/capabilities-tools";
import { registerCronjobTool } from "@freeanima/connectors-cron/cronjob-tool";
import type { Kernel } from "@freeanima/kernel";
import {
  registerMemoryPipeline,
  registerMemoryTools,
  registerReflectChat,
  type ReflectChatFn,
} from "@freeanima/life-memory";

let toolsRegistered = false;

/** 注册全部本地/MCP 无关工具（幂等） */
export function registerServiceTools(): void {
  if (toolsRegistered) return;
  registerCoreTools();
  registerSupplementalTools();
  registerMemoryTools();
  registerClarifyTool();
  registerCronjobTool();
  toolsRegistered = true;
}

/** @deprecated 使用 registerServiceTools */
export function registerAllTools(): void {
  registerServiceTools();
}

/** 注册 clarify hook 与 ACP 工具（需 kernel） */
export function registerServiceIntegrations(kernel: Kernel): void {
  registerClarifyHooks(kernel);
  getAcpManager().registerTools();
}

/** 注册记忆管道 reflect LLM 与 EventBus 订阅，并启动 EventBus */
export function registerServiceMemoryBus(opts: {
  kernel: Kernel;
  reflectChat: ReflectChatFn;
}): void {
  registerReflectChat(opts.reflectChat);
  registerMemoryPipeline(opts.kernel.eventBus);
  opts.kernel.eventBus.start();
}
