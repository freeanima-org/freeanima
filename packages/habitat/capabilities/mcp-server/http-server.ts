import { randomUUID } from "node:crypto";
import { readAppVersionForCapability as readAppVersion } from "@freeanima/habitat/core/config/capability-injection";
import type { VerifiedServiceApiToken } from "@freeanima/habitat/core/db/pg/service-api-token";
import {
  handlerResultToMcpContent,
  omitToolCallTitle,
  runWithToolContext,
  toolError,
  toolParametersToMcpInputSchema,
  validateToolArgs,
  type ToolSetRegistry,
} from "@freeanima/habitat/core/tool";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

export type McpServerDeps = {
  toolSets: ToolSetRegistry;
};

export type McpCallContext = {
  callerAuth?: VerifiedServiceApiToken | null;
};

export const MCP_HTTP_PATH = "/mcp";

/** Habitat Streamable HTTP MCP endpoint path */
export function isMcpPath(pathname: string): boolean {
  return pathname === MCP_HTTP_PATH || pathname === `${MCP_HTTP_PATH}/`;
}

function createMcpServer(deps: McpServerDeps, callCtx?: McpCallContext): Server {
  const server = new Server(
    { name: "freeanima", version: readAppVersion() },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: deps.toolSets.listMcpExposedTools().map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: toolParametersToMcpInputSchema(tool.parameters),
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const args = request.params.arguments ?? {};
    const tool = deps.toolSets.getTool(name);
    if (!tool?.exposeMcp) {
      return {
        content: [{ type: "text" as const, text: `Tool not found or not exposed: ${name}` }],
        isError: true,
      };
    }
    const validated = validateToolArgs(tool.parameters, args);
    if (!validated.ok) {
      return handlerResultToMcpContent(toolError(validated.error));
    }
    const sessionId = randomUUID();
    const callerAuth = callCtx?.callerAuth ?? undefined;
    const text = await runWithToolContext(
      `mcp:${sessionId}`,
      () => tool.handler(omitToolCallTitle(validated.data)),
      {
        tools: deps.toolSets,
        contextKind: "auto_llm",
        ...(callerAuth ? { callerAuth } : {}),
      },
    );
    return handlerResultToMcpContent(await Promise.resolve(text));
  });

  return server;
}

/** Stateless Streamable HTTP handler for Bun.serve fetch */
export function createMcpBunHandler(
  deps: McpServerDeps,
): (req: Request, ctx?: McpCallContext) => Promise<Response | undefined> {
  return async (req: Request, ctx?: McpCallContext): Promise<Response | undefined> => {
    if (!isMcpPath(new URL(req.url).pathname)) return undefined;

    const transport = new WebStandardStreamableHTTPServerTransport({
      enableJsonResponse: true,
    });
    const server = createMcpServer(deps, ctx);
    await server.connect(transport);
    try {
      return await transport.handleRequest(req);
    } finally {
      await transport.close();
      await server.close();
    }
  };
}
