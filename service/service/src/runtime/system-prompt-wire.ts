import { registerSystemPromptBuilder } from "@freeanima/engine-prompt";
import {
  composeSystemPrompt,
  decomposeSystemPromptParts as decomposeBase,
} from "@freeanima/life-memory/system-prompt";

registerSystemPromptBuilder((_functionNames, soulContent, cwd) => {
  const parts = decomposeBase(soulContent, cwd);
  return composeSystemPrompt(parts);
});
