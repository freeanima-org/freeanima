import { getActiveSkillsContent } from "@freeanima/engine";
import {
  composeSystemPrompt,
  decomposeSystemPromptParts as decomposeBase,
  type SystemPromptParts,
} from "@freeanima/memory/system-prompt";

export type { SystemPromptParts };

export function decomposeSystemPromptParts(
  soulContent: string,
  cwd?: string | null,
): SystemPromptParts {
  return decomposeBase(soulContent, cwd, getActiveSkillsContent(5));
}

export function buildSystemPrompt(
  _functionNames: string[],
  soulContent: string,
  cwd?: string | null,
): string {
  return composeSystemPrompt(decomposeSystemPromptParts(soulContent, cwd));
}
