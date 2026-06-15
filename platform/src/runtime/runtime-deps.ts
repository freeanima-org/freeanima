import type { Kernel } from "@freeanima/kernel";
import type { ConversationService } from "@freeanima/runtime/conversation";
import type { AcpManagerPort } from "@freeanima/platform/ports/ports/acp-manager";
import type { MaskRegistryPort } from "@freeanima/platform/ports/ports/mask-registry";
import type { McpManagerPort } from "@freeanima/platform/ports/ports/mcp-manager";
import type { SatelliteManagerPort } from "@freeanima/platform/ports/ports/satellite-manager";
import type { ServiceEnginePort } from "@freeanima/platform/ports/ports/service-engine";

/** 显式运行时依赖；域模块首参，禁止 Service Locator */
export type RuntimeDeps = {
  kernel: Kernel;
  engine: ServiceEnginePort;
  conversation: ConversationService;
};

export type FullRuntimeDeps = RuntimeDeps & {
  masks: MaskRegistryPort;
  mcp: McpManagerPort | null;
  satellite: SatelliteManagerPort | null;
  acp: AcpManagerPort;
  host: string;
  port: number;
};
