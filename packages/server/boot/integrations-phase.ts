import { logComponent } from "@freeanima/server/logging";
import {
  discoverPlatforms,
  startPlatforms,
  type PlatformAdapter,
} from "@freeanima/capabilities/connectors/gateway";
import type { AppRuntime } from "../service/app-runtime.ts";
import type { Engine } from "@freeanima/engine";
import type { MCPManager } from "@freeanima/capabilities/mcp-client";

import { startupLog } from "./status.ts";

/** 异步启动 MCP / Gateway（不阻塞 HTTP ready） */
export function startAsyncIntegrations(opts: {
  mcp: MCPManager;
  runtime: AppRuntime;
  engine: Engine;
  platformsRef: { list: PlatformAdapter[] };
}): void {
  opts.mcp.startAllAsync();

  void discoverPlatforms(opts.runtime, opts.engine.config)
    .then(async (adapters) => {
      opts.platformsRef.list = adapters;
      await startPlatforms(adapters);
    })
    .catch((err) => {
      logComponent("gateway").error("Platform startup failed", { err });
    });

  startupLog("Async integrations scheduled (MCP, Gateway)");
}
