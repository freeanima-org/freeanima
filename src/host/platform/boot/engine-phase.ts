import {
  createEngine,
  createEngineCatalog,
  type Engine,
  type EngineCatalog,
} from "@freeanima/host/engine";
import { getLlmRuntime, initLlmRuntime } from "@freeanima/host/core/llm";
import { isLlmConfigured } from "@freeanima/host/core/config";
import { createServiceKernel } from "@freeanima/host/platform/bootstrap";
import {
  createConversationService,
  type ConversationService,
} from "@freeanima/host/engine/conversation";
import { createServiceLogger, logComponent } from "@freeanima/host/platform/logging";
import { MaskRegistry } from "@freeanima/host/core/mask";
import { MCPManager } from "@freeanima/host/capabilities/mcp-client";
import { RemoteToolsManager } from "@freeanima/host/capabilities/outpost";
import { getAcpManager } from "@freeanima/host/capabilities/acp";
import { bindContextWindowLookup } from "../bind-context-window.ts";
import type { Kernel } from "@freeanima/host/kernel";
import type { RuntimeConfigStore } from "@freeanima/host/platform/config";

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
  outpost: RemoteToolsManager;
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
  const acp = getAcpManager();

  return {
    kernel,
    engine,
    conversation,
    catalog,
    masks,
    mcp,
    outpost,
    acp,
  };
}
