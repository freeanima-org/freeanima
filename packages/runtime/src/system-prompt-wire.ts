import { registerSystemPromptBuilder } from "@freeanima/engine-prompt";
import { getActiveSkillsContent } from "@freeanima/life-memory";
import {
  composeSystemPrompt,
  decomposeSystemPromptParts as decomposeBase,
} from "@freeanima/legacy-memory/system-prompt";

registerSystemPromptBuilder((_functionNames, soulContent, cwd) => {
  const skills = getActiveSkillsContent(5);
  const parts = decomposeBase(soulContent, cwd, skills);
  return composeSystemPrompt(parts);
});
