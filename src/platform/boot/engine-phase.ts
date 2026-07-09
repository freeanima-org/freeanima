import {
  createEngine,
  createEngineCatalog,
  type Engine,
  type EngineCatalog,
} from "@freeanima/runtime";
import { getLlmRuntime, initLlmRuntime } from "@freeanima/core/llm";
import { createServiceKernel } from "@freeanima/platform/bootstrap";
import {
  createConversationService,
  type ConversationService,
} from "@freeanima/runtime/conversation";
import { createServiceLogger } from "@freeanima/platform/logging";
import { MaskRegistry } from "@freeanima/features/task/domain/mask";
import { MCPManager } from "@freeanima/capabilities/mcp-client";
import { SatelliteManager } from "@freeanima/capabilities/satellite";
import { getAcpManager } from "@freeanima/capabilities/acp";
import { wireContextWindowLookup } from "../wire-context-window.ts";
import type { Kernel } from "@freeanima/kernel";
import type { HybridConfig } from "@freeanima/platform/config";

import { registerServiceTools } from "../register.ts";
import { registerServiceIntegrations } from "../register.ts";
import { startupLog } from "./status.ts";

export type EnginePhaseResult = {
  kernel: Kernel;
  engine: Engine;
  conversation: ConversationService;
  catalog: EngineCatalog;
  masks: MaskRegistry;
  mcp: MCPManager;
  satellite: SatelliteManager;
  acp: ReturnType<typeof getAcpManager>;
};

/** Phase 3: catalog、kernel、engine、conversation、MCP/ACP 管理器 */
export function bootEnginePhase(
  config: HybridConfig,
  onConversationUpdated: (conversationId: string) => void,
): EnginePhaseResult {
  startupLog("Registering tools…");
  const catalog = createEngineCatalog();
  const masks = new MaskRegistry();
  registerServiceTools({ toolSets: catalog.toolSets, skills: catalog.skills, config });
  const kernel = createServiceKernel(config);

  initLlmRuntime(config.data);
  wireContextWindowLookup();
  const logger = createServiceLogger();
  const engine = createEngine({ llm: getLlmRuntime(), catalog, config, logger });
  const conversation = createConversationService(catalog.toolSets);

  registerServiceIntegrations({
    kernel,
    conversation,
    toolSets: catalog.toolSets,
    skills: catalog.skills,
    config,
    onConversationUpdated,
  });

  const mcp = new MCPManager(catalog.toolSets, config);
  const satellite = new SatelliteManager(catalog.toolSets);
  satellite.installToolRouting();
  const acp = getAcpManager();

  return {
    kernel,
    engine,
    conversation,
    catalog,
    masks,
    mcp,
    satellite,
    acp,
  };
}
