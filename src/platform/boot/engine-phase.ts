import {
  createEngine,
  createEngineCatalog,
  type Engine,
  type EngineCatalog,
} from "@freeanima/runtime";
import { getLlmRuntime, initLlmRuntime } from "@freeanima/core/llm";
import { isLlmConfigured } from "@freeanima/core/config";
import { createServiceKernel } from "@freeanima/platform/bootstrap";
import {
  createConversationService,
  type ConversationService,
} from "@freeanima/runtime/conversation";
import { createServiceLogger, logComponent } from "@freeanima/platform/logging";
import { MaskRegistry } from "@freeanima/features/task/domain/mask";
import { MCPManager } from "@freeanima/capabilities/mcp-client";
import { RemoteToolsManager } from "@freeanima/capabilities/remote-tools";
import { getAcpManager } from "@freeanima/capabilities/acp";
import { bindContextWindowLookup } from "../bind-context-window.ts";
import type { Kernel } from "@freeanima/kernel";
import type { RuntimeConfigStore } from "@freeanima/platform/config";

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
  satellite: RemoteToolsManager;
  acp: ReturnType<typeof getAcpManager>;
};

/** Phase 3: catalog、kernel、engine、conversation、MCP/ACP 管理器 */
export function bootEnginePhase(
  config: RuntimeConfigStore,
  onConversationUpdated: (conversationId: string) => void,
): EnginePhaseResult {
  startupLog("Registering tools…");
  const catalog = createEngineCatalog();
  const masks = new MaskRegistry();
  registerServiceTools({ toolSets: catalog.toolSets, skills: catalog.skills, config });
  const kernel = createServiceKernel(config);

  initLlmRuntime(config.data);
  if (!isLlmConfigured(config.data)) {
    logComponent("startup").warn("LLM 未配置；请在 Shell 设置 → Habitat 服务中配置后重启服务");
  }
  bindContextWindowLookup();
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
  const satellite = new RemoteToolsManager(catalog.toolSets);
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
