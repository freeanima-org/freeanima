import type { SubagentBody } from "@freeanima/habitat/core/db/schema/entity";
import type {
  SubagentPromptInclude,
  SubagentTemperatureTier,
} from "@freeanima/habitat/core/db/schema/entity/components/subagent.ts";

export type { SubagentTemperatureTier };

export type SubagentRow = SubagentBody & {
  id: number;
  title: string;
  summary: string;
  content: string;
  world_id: number;
  tag_ids: number[];
  created_at: string;
  updated_at: string;
};

export type SubagentCreateInput = {
  slug: string;
  title: string;
  summary?: string;
  content?: string;
  skills?: string[];
  max_loop_iterations?: number | null;
  temperature_tier?: SubagentTemperatureTier | null;
  allowed_tools?: string[];
  denied_tools?: string[];
  prompt_includes?: SubagentPromptInclude[];
};

export type SubagentUpdateInput = {
  id: number;
  slug?: string;
  title?: string;
  summary?: string;
  content?: string;
  skills?: string[];
  max_loop_iterations?: number | null;
  temperature_tier?: SubagentTemperatureTier | null;
  allowed_tools?: string[];
  denied_tools?: string[];
  prompt_includes?: SubagentPromptInclude[];
};

/**
 * 派发任务：具名（slug|id）或临时（instructions + allowed_tools）。
 * 临时不得扩权具名档案；具名不得用调用方 allowed_tools 扩大天花板。
 */
export type SubagentTaskInput = {
  slug?: string;
  id?: number;
  goal: string;
  /** Short human-readable AutoLlm run_name（父 LLM 宜填写） */
  title?: string;
  /** 临时：角色/系统指令（无档案时必填） */
  instructions?: string;
  /** 临时：工具天花板（无档案时必填，可为空数组=无工具）；具名时忽略（不可扩权） */
  allowed_tools?: string[];
  context?: string;
  skills?: string[];
  max_loop_iterations?: number;
  temperature_tier?: SubagentTemperatureTier;
  denied_tools?: string[];
  /** 与档案 prompt_includes 并集；仅 opt-in */
  prompt_includes?: SubagentPromptInclude[];
};

/** 解析后的统一执行画像（具名或临时） */
export type ResolvedSubagentProfile = {
  kind: "named" | "ephemeral";
  id: number | null;
  slug: string;
  title: string;
  summary: string;
  content: string;
  skills: string[];
  max_loop_iterations: number | null;
  temperature_tier: SubagentTemperatureTier | null;
  allowed_tools: string[];
  denied_tools: string[];
  prompt_includes: SubagentPromptInclude[];
  world_id: number;
};
