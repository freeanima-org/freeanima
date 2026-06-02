import { registerSystemPromptBuilder, getActiveSkillsContent } from "@freeanima/legacy-engine";
import {
  composeSystemPrompt,
  decomposeSystemPromptParts as decomposeBase,
} from "@freeanima/legacy-memory/system-prompt";

registerSystemPromptBuilder((_functionNames, soulContent, cwd) => {
  const skills = getActiveSkillsContent(5);
  const parts = decomposeBase(soulContent, cwd, skills);
  return composeSystemPrompt(parts);
});
