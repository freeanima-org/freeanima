export type AcpControlResult = {
  ok: boolean;
  error?: string;
  agent?: string;
  action?: "start" | "stop";
};

export type AcpStatusResponse = {
  agent_count: number;
  connected_count: number;
  session_count: number;
  tool_count: number;
  agents: unknown[];
};

/** ACP 运行时管理端口 */
export interface AcpManagerPort {
  getStatus(): AcpStatusResponse;
  startAll(): Promise<AcpControlResult>;
  stopAll(): Promise<AcpControlResult>;
  startAgent(name: string): Promise<AcpControlResult>;
  stopAgent(name: string): Promise<AcpControlResult>;
}
