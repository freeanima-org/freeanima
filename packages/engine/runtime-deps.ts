import type { Kernel } from "@freeanima/kernel";

import type { ConversationService } from "./conversation/index.ts";
import type { ServiceEnginePort } from "@freeanima/engine/service-engine.ts";

/** 显式运行时依赖；域模块首参，禁止 Service Locator。 */
export type RuntimeDeps = {
  kernel: Kernel;
  engine: ServiceEnginePort;
  conversation: ConversationService;
};

export type { ServiceEnginePort };
