import type { ConversationMetaMessage } from "@freeanima/core/db/domain";
import { createHook } from "@freeanima/kernel/hooks";

export type SystemPromptBuildContext = {
  functionNames: string[];
  cwd?: string | null;
  meta?: ConversationMetaMessage;
};

export type SystemPromptSection = {
  id: string;
  content: string;
  order: number;
};

export type SystemPromptBuildEffect = {
  sections?: SystemPromptSection[];
};

export const systemPromptBuild = createHook<SystemPromptBuildContext, SystemPromptBuildEffect>(
  "@freeanima/core/hooks/system-prompt-build",
  "Assemble system prompt sections from registered modules",
);
