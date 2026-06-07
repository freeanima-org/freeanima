import { registerSystemPromptBuilder } from "@freeanima/engine-prompt";
import { loadSelfLayerPrompt } from "@freeanima/life-self";
import {
  composeSystemPrompt,
  decomposeSystemPromptParts as decomposeBase,
} from "@freeanima/life-memory/system-prompt";

registerSystemPromptBuilder(async (_functionNames, _soulContent, cwd) => {
  const selfContent = await loadSelfLayerPrompt();
  const parts = await decomposeBase(selfContent, cwd);
  return composeSystemPrompt(parts);
});
