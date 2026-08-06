import type { ConversationMetaMessage } from "@freeanima/host/core/db/domain";
import { createHook } from "@freeanima/host/kernel/hooks";
import type { PromptMode } from "./mode.ts";

export type SystemPromptBuildContext = {
  functionNames: string[];
  cwd?: string | null;
  meta?: ConversationMetaMessage;
  /** 由 meta.module 派生；钩子按此门控数字人类相关区块 */
  mode: PromptMode;
};

export type SystemPromptSection = {
  id: string;
  content: string;
  order: number;
  /** Per-section hard char cap (applied before global budget). */
  budgetChars?: number;
  /** Lower number = kept preferentially when over global budget (default 100). */
  priority?: number;
};

export type SystemPromptBuildEffect = {
  sections?: SystemPromptSection[];
};

export const systemPromptBuild = createHook<SystemPromptBuildContext, SystemPromptBuildEffect>(
  "@freeanima/host/core/hooks/system-prompt-build",
  "Assemble system prompt sections from registered modules",
);
