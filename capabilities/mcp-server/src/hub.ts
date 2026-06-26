import { readAppVersionForCapability as readAppVersion } from "@freeanima/core/config";
import type { PgRepositories } from "@freeanima/core/repos";
import {
  handlerResultToMcpContent,
  runWithToolContext,
  toolParametersToMcpInputSchema,
  type ToolSetRegistry,
} from "@freeanima/core/tool";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

export type McpHubDeps = {
  toolSets: ToolSetRegistry;
  repos: PgRepositories;
};

export const MCP_HTTP_PATH = "/mcp";

/** Hub Streamable HTTP MCP endpoint path */
export function isMcpPath(pathname: string): boolean {
  return pathname === MCP_HTTP_PATH || pathname === `${MCP_HTTP_PATH}/`;
}

function createMcpServer(deps: McpHubDeps): Server {
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
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;
    const tool = deps.toolSets.getTool(name);
    if (!tool?.exposeMcp) {
      return {
        content: [{ type: "text" as const, text: `Tool not found or not exposed: ${name}` }],
        isError: true,
      };
    }
    const sessionId = crypto.randomUUID();
    const text = await runWithToolContext(`mcp:${sessionId}`, () => tool.handler(args), {
      tools: deps.toolSets,
      repos: deps.repos,
      contextKind: "auto_llm",
    });
    return handlerResultToMcpContent(await Promise.resolve(text));
  });

  return server;
}

/** Stateless Streamable HTTP handler for Bun.serve fetch */
export function createMcpBunHandler(
  deps: McpHubDeps,
): (req: Request) => Promise<Response | undefined> {
  return async (req: Request): Promise<Response | undefined> => {
    if (!isMcpPath(new URL(req.url).pathname)) return undefined;

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    const server = createMcpServer(deps);
    await server.connect(transport);
    try {
      return await transport.handleRequest(req);
    } finally {
      await transport.close();
      await server.close();
    }
  };
}
