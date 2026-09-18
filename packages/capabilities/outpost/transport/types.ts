import type { ConversationService } from "@freeanima/engine/conversation";
import type { RuntimeDeps } from "@freeanima/engine/runtime-deps.ts";
import type { ServiceEnginePort } from "@freeanima/engine/service-engine.ts";

import type { AppRuntimePort } from "../../ports/app-runtime-port.ts";
import type { RemoteToolsManager } from "@freeanima/capabilities/outpost";
import type { HabitatSessionRegistry } from "./habitat-session-registry.ts";
import type { RemoteInstanceRegistry } from "./instance-registry.ts";

export type RemoteToolsServerDeps = {
  runtime: RemoteToolsServerRuntime;
  remoteToolsManager: RemoteToolsManager;
  instanceRegistry: RemoteInstanceRegistry;
  hubSessionRegistry: HabitatSessionRegistry;
  animaVersion: string;
};

/**
 * Feature routes / outpost transport 看到的运行时门面。
 *
 * `server/service/app-runtime.ts` 的 `AppRuntime` 在编译期断言满足本接口
 * （见该文件底部 `_assertAppRuntimeSatisfiesFacade`），因此能力层与特性层
 * 不再需要 import 组合根的具体类。
 */
export type RemoteToolsServerRuntime = AppRuntimePort & {
  readonly conversation: ConversationService;
  readonly engine: ServiceEnginePort;
  runtimeDeps(): RuntimeDeps;
  emitSessionUpdated(conversationId: string): void;
  archiveConversation(conversationId: string, platform?: string): Promise<{ ok: boolean }>;
  unarchiveConversation(conversationId: string, platform?: string): Promise<{ ok: boolean }>;
  pinConversation(conversationId: string, platform?: string): Promise<{ ok: boolean }>;
  unpinConversation(conversationId: string, platform?: string): Promise<{ ok: boolean }>;
  deleteConversation(conversationId: string, platform?: string): Promise<{ ok: boolean }>;
  rollbackBeforeLastUser(conversationId: string, platform?: string): Promise<{ ok: boolean }>;
  interruptSessionStream(conversationId: string): void;
};
