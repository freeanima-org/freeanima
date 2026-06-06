import { registerSystemPromptBuilder } from "@freeanima/engine-prompt";
import {
  composeSystemPrompt,
  decomposeSystemPromptParts as decomposeBase,
} from "@freeanima/life-memory/system-prompt";

registerSystemPromptBuilder(async (_functionNames, soulContent, cwd) => {
  const parts = await decomposeBase(soulContent, cwd);
  return composeSystemPrompt(parts);
});
