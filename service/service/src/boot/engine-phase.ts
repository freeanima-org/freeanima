import {
  createEngine,
  createEngineCatalog,
  type Engine,
  type EngineCatalog,
} from "@freeanima/orchestration-runtime";
import { getLlmRuntime, initLlmRuntime } from "@freeanima/mechanism-llm";
import { createServiceKernel } from "@freeanima/service-bootstrap";
import {
  createConversationService,
  type ConversationService,
} from "@freeanima/orchestration-conversation";
import { createServiceLogger } from "@freeanima/service-logging";
import { MaskRegistry } from "@freeanima/capabilities-mask";
import { MCPManager } from "@freeanima/capabilities-mcp";
import { getAcpManager } from "@freeanima/capabilities-acp";
import { registerFridgeStore } from "@freeanima/capabilities-fridge-magnet";
import { createRedisFridgeStore } from "@freeanima/connectors-redis";
import type { Kernel } from "@freeanima/kernel";
import type { FileConfig } from "@freeanima/service-config";
import type { PgRepositories } from "@freeanima/storage-repos";

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
  acp: ReturnType<typeof getAcpManager>;
};

/** Phase 3: catalog、kernel、engine、conversation、MCP/ACP 管理器 */
export function bootEnginePhase(
  config: FileConfig,
  repos: PgRepositories,
  onSessionUpdated: (sessionId: string) => void,
): EnginePhaseResult {
  startupLog("Registering tools…");
  const catalog = createEngineCatalog();
  const masks = new MaskRegistry();
  registerServiceTools({ toolSets: catalog.toolSets, skills: catalog.skills, config });
  const kernel = createServiceKernel(config);

  initLlmRuntime(config.data);
  const logger = createServiceLogger();
  const engine = createEngine({ repos, llm: getLlmRuntime(), catalog, config, logger });
  const conversation = createConversationService(engine.repos, catalog.toolSets);

  registerServiceIntegrations({
    kernel,
    conversation,
    toolSets: catalog.toolSets,
    skills: catalog.skills,
    config,
    onSessionUpdated,
  });

  registerFridgeStore(createRedisFridgeStore());
  const mcp = new MCPManager(catalog.toolSets, config);
  const acp = getAcpManager();

  return { kernel, engine, conversation, catalog, masks, mcp, acp };
}
