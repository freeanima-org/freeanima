import { logComponent } from "@freeanima/habitat/platform/logging";
import {
  discoverPlatforms,
  startPlatforms,
  type PlatformAdapter,
} from "@freeanima/habitat/capabilities/connectors/gateway";
import type { AppRuntime } from "../service/app-runtime.ts";
import type { Engine } from "@freeanima/habitat/engine";
import type { MCPManager } from "@freeanima/habitat/capabilities/mcp-client";

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
