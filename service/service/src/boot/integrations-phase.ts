import { logComponent } from "@freeanima/service-logging";
import {
  discoverPlatforms,
  startPlatforms,
  type PlatformAdapter,
} from "@freeanima/connectors-gateway";
import { startAcpProgressTicker } from "../register.ts";
import type { AppRuntime } from "../runtime/app-runtime.ts";
import type { Engine } from "@freeanima/orchestration-runtime";
import { getAcpManager } from "@freeanima/capabilities-acp";
import type { MCPManager } from "@freeanima/capabilities-mcp";

import { startupLog } from "./status.ts";

/** 异步启动 MCP / ACP / Gateway（不阻塞 HTTP ready） */
export function startAsyncIntegrations(opts: {
  mcp: MCPManager;
  acp: ReturnType<typeof getAcpManager>;
  runtime: AppRuntime;
  engine: Engine;
  platformsRef: { list: PlatformAdapter[] };
}): void {
  opts.mcp.startAllAsync();
  opts.acp.startAllAsync();
  startAcpProgressTicker();

  void discoverPlatforms(opts.runtime, opts.engine.config)
    .then(async (adapters) => {
      opts.platformsRef.list = adapters;
      await startPlatforms(adapters);
    })
    .catch((err) => {
      logComponent("gateway").error("Platform startup failed", { err });
    });

  startupLog("Async integrations scheduled (MCP, ACP, Gateway)");
}
