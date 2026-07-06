import { consoleCtx } from "./runtime.ts";
import { ApiHandlerError } from "./errors.ts";

export async function getMcpStatus() {
  const { mcp } = consoleCtx();
  if (!mcp) {
    return {
      server_count: 0,
      connected_count: 0,
      connecting_count: 0,
      tool_count: 0,
      servers: [],
    };
  }
  return mcp.getStatus();
}

export async function mcpStartAll() {
  const { mcp } = consoleCtx();
  if (!mcp) throw new ApiHandlerError(503, "MCP manager not available");
  const result = await mcp.startAllEnabled();
  if (!result.ok) throw new ApiHandlerError(400, result.error ?? "start failed");
  return { ok: true as const, ...(await mcp.getStatus()) };
}

export async function mcpStopAll() {
  const { mcp } = consoleCtx();
  if (!mcp) throw new ApiHandlerError(503, "MCP manager not available");
  const result = await mcp.stopAll();
  if (!result.ok) throw new ApiHandlerError(400, result.error ?? "stop failed");
  return { ok: true as const, ...(await mcp.getStatus()) };
}

export async function mcpStartServer(name: string) {
  const { mcp } = consoleCtx();
  if (!mcp) throw new ApiHandlerError(503, "MCP manager not available");
  const result = await mcp.startServer(name);
  if (!result.ok) {
    throw new ApiHandlerError(400, result.error ?? "start failed", { server: name });
  }
  return { ok: true as const, ...(await mcp.getStatus()) };
}

export async function mcpStopServer(name: string) {
  const { mcp } = consoleCtx();
  if (!mcp) throw new ApiHandlerError(503, "MCP manager not available");
  const result = await mcp.stopServer(name);
  if (!result.ok) {
    throw new ApiHandlerError(400, result.error ?? "stop failed", { server: name });
  }
  return { ok: true as const, ...(await mcp.getStatus()) };
}
