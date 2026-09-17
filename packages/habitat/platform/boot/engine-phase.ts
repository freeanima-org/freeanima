import {
  createEngine,
  createEngineCatalog,
  type Engine,
  type EngineCatalog,
} from "@freeanima/habitat/engine";
import { getLlmRuntime, initLlmRuntime, LlmStackService } from "@freeanima/habitat/core/llm";
import { isLlmConfigured } from "@freeanima/habitat/core/config";
import { createServiceKernel } from "@freeanima/habitat/platform/bootstrap";
import { filterHabitatLocalHandsForCoding, ToolPolicyService } from "@freeanima/habitat/core/tool";
import { bindLlmStack } from "@freeanima/habitat/capabilities/llm-openai";
import {
  createConversationService,
  type ConversationService,
} from "@freeanima/habitat/engine/conversation";
import { createServiceLogger, logComponent } from "@freeanima/habitat/platform/logging";
import { MCPManager } from "@freeanima/habitat/capabilities/mcp-client";
import { RemoteToolsManager } from "@freeanima/habitat/capabilities/outpost";
import { bindContextWindowLookup } from "../bind-context-window.ts";
import type { Kernel } from "@freeanima/kernel";
import type { RuntimeConfigStore } from "@freeanima/habitat/platform/config";

import { registerServiceTools } from "../register.ts";
import { registerServiceIntegrations } from "../register.ts";
import { startupLog } from "./status.ts";

export type EnginePhaseResult = {
  kernel: Kernel;
  engine: Engine;
  conversation: ConversationService;
  catalog: EngineCatalog;
  mcp: MCPManager;
  outpost: RemoteToolsManager;
};

/** Phase 3: catalog、kernel、engine、conversation、MCP 管理器 */
export async function bootEnginePhase(
  config: RuntimeConfigStore,
  onConversationUpdated: (conversationId: string) => void,
): Promise<EnginePhaseResult> {
  startupLog("Registering tools…");
  const catalog = createEngineCatalog();
  const kernel = createServiceKernel(config);

  await kernel.ctx.plugin(LlmStackService, { configurator: bindLlmStack });
  await kernel.ctx.plugin(ToolPolicyService, {
    filter: (toolNames, meta) => filterHabitatLocalHandsForCoding(toolNames, meta),
  });

  registerServiceTools({ toolSets: catalog.toolSets, skills: catalog.skills, config });

  initLlmRuntime(config.data);
  if (!isLlmConfigured(config.data)) {
    logComponent("startup").warn(
      "LLM 未配置；请在 Shell 设置 → Habitat 服务中配置（保存后热生效）",
    );
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
  const outpost = new RemoteToolsManager(catalog.toolSets);
  outpost.installToolRouting();

  return {
    kernel,
    engine,
    conversation,
    catalog,
    mcp,
    outpost,
  };
}
