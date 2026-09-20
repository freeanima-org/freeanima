import { Service, type Context } from "cordis";
import {
  DEFAULT_SYSTEM_PROMPT_BUDGET_CHARS,
  peekActiveRuntimeConfig,
} from "@freeanima/core/config";
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
 * 当前挂载的 SystemPromptService（`ctx.systemPrompt`）。
 *
 * 深层代码（engine 重建 system_prompt）没有 ctx，经该模块内句柄取用；
 * 服务构造时登记、ctx 释放时清除，不再查进程根 context。
 */
let current: SystemPromptService | null = null;

function registerCurrent(service: SystemPromptService): void {
  current = service;
}

function unregisterCurrent(service: SystemPromptService): void {
  if (current === service) current = null;
}

export function getSystemPromptService(): SystemPromptService | null {
  return current;
}

export function resetSystemPromptServiceForTest(): void {
  current = null;
}

/**
 * Cordis service owning system-prompt assembly as `ctx.systemPrompt`.
 *
 * Replaces the old module-global `SystemPromptHookRunner`: it runs the
 * `systemPromptBuild` Cordis event and folds the collected effects.
 */
export class SystemPromptService extends Service {
  private onFold?: SystemPromptServiceConfig["onFold"];

  constructor(ctx: Context, config: SystemPromptServiceConfig = {}) {
    super(ctx, "systemPrompt");
    this.onFold = config.onFold;
    registerCurrent(this);
    ctx.effect(() => () => {
      unregisterCurrent(this);
    });
  }

  setOnFold(onFold: SystemPromptServiceConfig["onFold"]): void {
    this.onFold = onFold;
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

/** Mount synchronously (idempotent: re-mounting reuses the existing instance). */
export function mountSystemPromptService(
  ctx: Context,
  config: SystemPromptServiceConfig = {},
): SystemPromptService {
  const existing = ctx.systemPrompt as SystemPromptService | undefined;
  if (existing) {
    if (config.onFold) existing.setOnFold(config.onFold);
    return existing;
  }
  return new SystemPromptService(ctx, config);
}
