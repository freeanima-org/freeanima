import type { ConversationMetaMessage } from "@freeanima/habitat/core/db/domain";
import { createHook } from "@freeanima/habitat/kernel/hooks";
import type { PromptMode } from "./scenario.ts";
import type { PromptXmlAttrs } from "./xml-wrap.ts";

export type SystemPromptBuildContext = {
  functionNames: string[];
  cwd?: string | null;
  meta?: ConversationMetaMessage;
  /** 由 meta.scenario → resolveScenarioProfile().prompt 派生；钩子按此门控数字人类相关区块 */
  mode: PromptMode;
};

export type SystemPromptSection = {
  id: string;
  /**
   * Section body. When `xmlTag` is set this is the *inner* payload (truncated before wrap);
   * otherwise it is the final rendered text.
   */
  content: string;
  order: number;
  /** Per-section hard char cap on *final* rendered length (applied before global budget). */
  budgetChars?: number;
  /** Lower number = kept preferentially when over global budget (default 100). */
  priority?: number;
  /** When set, fold truncates `content` then wraps with this tag (+ optional frame). */
  xmlTag?: string;
  /** Imperative / second-person frame outside the XML tag (not truncated into the tag). */
  xmlFrame?: string;
  xmlAttrs?: PromptXmlAttrs;
};

export type SystemPromptBuildEffect = {
  sections?: SystemPromptSection[];
};

export const systemPromptBuild = createHook<SystemPromptBuildContext, SystemPromptBuildEffect>(
  "@freeanima/habitat/core/hooks/system-prompt-build",
  "Assemble system prompt sections from registered modules",
);
