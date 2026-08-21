import { z } from "zod";

/** 聊天相关运行时配置（全端共享；默认 agent 仅用于新建会话预选） */
export const chatConfigSchema = z.object({
  /** Chat / Coding conversation.create 预选；禁止作为工具/仓库 world 回退 */
  default_agent_subject_id: z.number().int().positive().optional(),
  /** LLM debug 开关（原本机 chat prefs） */
  llm_debug_enabled: z.boolean().optional(),
});

export type ChatConfig = z.infer<typeof chatConfigSchema>;
