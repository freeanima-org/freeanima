/** 项目 Agent 资产归一化类型（Coding Outpost 发现 → Habitat 会话叠加） */

export type ProjectAssetSource =
  | "agents"
  | "agents-md"
  | "claude-md"
  | "claude"
  | "cursor"
  | "opencode"
  | "mcp-root"
  | "mcp-vscode"
  | "mcp-cursor";

export type ProjectRuleKind = "always" | "requestable";

export type ProjectRule = {
  id: string;
  /** workspace 相对路径 */
  path: string;
  kind: ProjectRuleKind;
  content: string;
  source: ProjectAssetSource;
  /** Cursor glob 等；仅 requestable 有意义 */
  globs?: string[];
};

export type ProjectSkill = {
  name: string;
  description: string;
  /** SKILL.md 相对路径 */
  path: string;
  source: ProjectAssetSource;
  /** 可选：同步时带上 body（截断）；缺省则按需读盘 */
  body?: string;
};

export type ProjectAgentProfile = {
  slug: string;
  description: string;
  path: string;
  source: ProjectAssetSource;
  /** role / instructions body */
  content: string;
  allowed_tools?: string[];
};

export type ProjectMcpServerConfig = {
  command?: string;
  args?: string[];
  url?: string;
  transport?: "stdio" | "sse" | "http";
  headers?: Record<string, string>;
  env?: Record<string, string>;
  cwd?: string;
  enabled?: boolean;
};

export type ProjectMcpServer = {
  name: string;
  config: ProjectMcpServerConfig;
  source: ProjectAssetSource;
  /** 配置文件相对路径 */
  path: string;
};

export type ProjectAgentContext = {
  rules: ProjectRule[];
  skills: ProjectSkill[];
  agents: ProjectAgentProfile[];
  mcpServers: ProjectMcpServer[];
  /** 是否存在可写的 AGENTS.md（或可创建） */
  agentsMdPath: string | null;
  sources: ProjectAssetSource[];
};

export type ProjectAgentContextSnapshot = ProjectAgentContext & {
  discovered_at: string;
  workspace_root: string;
};
