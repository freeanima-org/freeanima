export type FridgeMagnetItem = {
  key: string;
  value: string;
  module: "conversation" | "other";
  conversation_id?: string;
  label?: string;
  ttl_seconds: number | null;
};

export type FridgeMagnetsResponse = {
  redis_configured: boolean;
  magnets: FridgeMagnetItem[];
  inject_text: string;
};

export type ToolsStatusToolItem = {
  name: string;
  description: string;
  toolset?: string;
  parameters: Record<string, unknown>;
  requires_env?: string[];
  definition: {
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  };
  return_kind: "json" | "text";
  return_schema?: Record<string, unknown>;
  return_example?: unknown;
  return_text_hint?: string;
  error_schema: Record<string, unknown>;
  error_example: { error: string };
};

export type ToolsStatusResponse = {
  default_toolsets: string[];
  tools: ToolsStatusToolItem[];
  toolsets: Array<{
    name: string;
    description: string;
    tools: string[];
  }>;
};

export type PromptDebugResponse = {
  mode: "global" | "conversation";
  conversation_id?: string;
  system: {
    parts: {
      self: string;
      agents: string;
      resident: string;
      toolsets: string;
    };
    composed: string;
    stored?: string | null;
    in_sync?: boolean;
    breakdown: {
      system_self: number;
      system_agents: number;
      system_resident: number;
      system_toolsets: number;
      summary: number;
      messages: number;
      tools: number;
      total: number;
    };
  };
  tools: {
    mode: "registry" | "conversation";
    count: number;
    tokens_est: number;
    items: Array<{
      name: string;
      description: string;
      toolset?: string;
      parameters: Record<string, unknown>;
    }>;
  };
  meta?: {
    cwd?: string | null;
    capability_mask?: { presets: string[] };
    tool_names?: string[];
  };
};
