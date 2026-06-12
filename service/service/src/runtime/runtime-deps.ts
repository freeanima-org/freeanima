import type { Kernel } from "@freeanima/kernel";
import type { ConversationService } from "@freeanima/orchestration-conversation";
import type { AcpManagerPort } from "@freeanima/service-api/ports/acp-manager";
import type { MaskRegistryPort } from "@freeanima/service-api/ports/mask-registry";
import type { McpManagerPort } from "@freeanima/service-api/ports/mcp-manager";
import type { ServiceEnginePort } from "@freeanima/service-api/ports/service-engine";

/** 显式运行时依赖；域模块首参，禁止 Service Locator */
export type RuntimeDeps = {
  kernel: Kernel;
  engine: ServiceEnginePort;
  conversation: ConversationService;
};

export type FullRuntimeDeps = RuntimeDeps & {
  masks: MaskRegistryPort;
  mcp: McpManagerPort | null;
  acp: AcpManagerPort;
  host: string;
  port: number;
};
