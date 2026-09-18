import type { RuntimeDeps } from "@freeanima/engine/runtime-deps.ts";

import type { McpManagerPort } from "./mcp-manager.ts";
import type { RemoteToolsManagerPort } from "./remote-tools-manager.ts";

/** 组合根提供的完整运行时依赖（= RuntimeDeps + 能力侧管理器与监听信息）。 */
export type FullRuntimeDeps = RuntimeDeps & {
  mcp: McpManagerPort | null;
  outpost: RemoteToolsManagerPort | null;
  host: string;
  port: number;
};

export type { RuntimeDeps };
