import type { ConversationMetaMessage } from "@freeanima/host/core/db/domain";
import { createHook } from "@freeanima/host/kernel/hooks";

export type SystemPromptBuildContext = {
  functionNames: string[];
  cwd?: string | null;
  meta?: ConversationMetaMessage;
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
