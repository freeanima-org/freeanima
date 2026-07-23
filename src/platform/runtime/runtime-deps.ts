import type { Kernel } from "@freeanima/kernel";
import type { ConversationService } from "@freeanima/runtime/conversation";
import type { AcpManagerPort } from "@freeanima/platform/ports/acp-manager";
import type { MaskRegistryPort } from "@freeanima/platform/ports/mask-registry";
import type { McpManagerPort } from "@freeanima/platform/ports/mcp-manager";
import type { RemoteToolsManagerPort } from "@freeanima/platform/ports/remote-tools-manager";
import type { ServiceEnginePort } from "@freeanima/platform/ports/service-engine";

/** 显式运行时依赖；域模块首参，禁止 Service Locator */
export type RuntimeDeps = {
  kernel: Kernel;
  engine: ServiceEnginePort;
  conversation: ConversationService;
};

export type FullRuntimeDeps = RuntimeDeps & {
  masks: MaskRegistryPort;
  mcp: McpManagerPort | null;
  outpost: RemoteToolsManagerPort | null;
  acp: AcpManagerPort;
  host: string;
  port: number;
};
