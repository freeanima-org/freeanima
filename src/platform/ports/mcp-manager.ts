export type McpControlResult = {
  ok: boolean;
  error?: string;
  server?: string;
  action?: "start" | "stop";
};

export type McpStatusResponse = {
  server_count: number;
  connected_count: number;
  connecting_count: number;
  tool_count: number;
  servers: unknown[];
};

/** MCP runtime management port */
export interface McpManagerPort {
  getToolCount(): number;
  getConnectionSummary(): {
    server_count: number;
    connected_count: number;
    connecting_count: number;
  };
  getStatus(): McpStatusResponse | Promise<McpStatusResponse>;
  startAllEnabled(): Promise<McpControlResult>;
  stopAll(): Promise<McpControlResult>;
  startServer(name: string): Promise<McpControlResult>;
  stopServer(name: string): Promise<McpControlResult>;
}
