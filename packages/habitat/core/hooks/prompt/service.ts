import { Service, type Context } from "cordis";
import {
  DEFAULT_SYSTEM_PROMPT_BUDGET_CHARS,
  peekActiveRuntimeConfig,
} from "@freeanima/habitat/core/config";
import { runSystemPromptBuild } from "../cordis/index.ts";
import type { SystemPromptBuildContext } from "./hooks.ts";
import { foldSystemPromptSectionsDetailed, type FoldSystemPromptResult } from "./fold.ts";

declare module "cordis" {
  interface Context {
    systemPrompt: SystemPromptService;
  }
}

export type SystemPromptServiceConfig = {
  /** Invoked after folding (e.g. platform soft-failure notify on truncation). */
  onFold?: (folded: FoldSystemPromptResult) => void | Promise<void>;
};

/**
 * Cordis service owning system-prompt assembly as `ctx.systemPrompt`.
 *
 * Replaces the old module-global `SystemPromptHookRunner`: it runs the
 * `systemPromptBuild` Cordis event and folds the collected effects.
 */
export class SystemPromptService extends Service {
  private readonly onFold?: SystemPromptServiceConfig["onFold"];

  constructor(ctx: Context, config: SystemPromptServiceConfig = {}) {
    super(ctx, "systemPrompt");
    this.onFold = config.onFold;
  }

  async build(payload: SystemPromptBuildContext): Promise<string> {
    const effects = await runSystemPromptBuild(this.ctx.root, payload);
    const budget =
      peekActiveRuntimeConfig()?.data.prompt?.system_prompt_budget_chars ??
      DEFAULT_SYSTEM_PROMPT_BUDGET_CHARS;
    const folded = foldSystemPromptSectionsDetailed(effects, { globalBudgetChars: budget });
    await this.onFold?.(folded);
    return folded.text;
  }
}
