import { registerSystemPromptBuilder } from "@freeanima/engine";
import { getActiveSkillsContent } from "@freeanima/engine";
import {
  composeSystemPrompt,
  decomposeSystemPromptParts as decomposeBase,
} from "@freeanima/memory/system-prompt";

registerSystemPromptBuilder((_functionNames, soulContent, cwd) => {
  const skills = getActiveSkillsContent(5);
  const parts = decomposeBase(soulContent, cwd, skills);
  return composeSystemPrompt(parts);
});
