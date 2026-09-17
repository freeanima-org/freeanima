import type { Kernel } from "@freeanima/kernel";
import type { ConversationService } from "@freeanima/engine/conversation";
import type { McpManagerPort } from "@freeanima/server/ports/mcp-manager";
import type { RemoteToolsManagerPort } from "@freeanima/server/ports/remote-tools-manager";
import type { ServiceEnginePort } from "@freeanima/server/ports/service-engine";

/** 显式运行时依赖；域模块首参，禁止 Service Locator */
export type RuntimeDeps = {
  kernel: Kernel;
  engine: ServiceEnginePort;
  conversation: ConversationService;
};

export type FullRuntimeDeps = RuntimeDeps & {
  mcp: McpManagerPort | null;
  outpost: RemoteToolsManagerPort | null;
  host: string;
  port: number;
};
