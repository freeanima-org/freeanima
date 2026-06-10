import type { Command } from "commander";
import { bootstrapMemoryJobs } from "@freeanima/service/bootstrap-memory-jobs";
import { runLightSleepBackfill } from "@freeanima/life-memory/light-sleep/backfill";

export function registerMemoryCommand(program: Command): void {
  const memory = program.command("memory").description("记忆管道 CLI");

  const sleep = memory.command("sleep").description("浅睡 / 深睡批处理");

  sleep
    .command("backfill")
    .description("按 CST 自然日历史补跑浅睡（从最早 session 到昨日）")
    .option("--from <day>", "起始日 YYYY-MM-DD（默认最早 session 日）")
    .option("--to <day>", "截止日 YYYY-MM-DD（默认昨日 CST）")
    .option("--resume", "从 ~/.anima/runtime/light_sleep_backfill_state.json 续跑")
    .action(async (opts: { from?: string; to?: string; resume?: boolean }) => {
      const ctx = await bootstrapMemoryJobs();
      try {
        const result = await runLightSleepBackfill({
          sessionStore: ctx.repos.session,
          semanticStore: ctx.repos.semanticMemory,
          autoStore: ctx.repos.autobiographicalMemory,
          selfStore: ctx.repos.selfLayer,
          selfContent: ctx.selfContent,
          fromDay: opts.from,
          toDay: opts.to,
          resume: Boolean(opts.resume),
        });
        console.log(JSON.stringify(result, null, 2));
        if (!result.ok) process.exit(1);
      } finally {
        await ctx.cleanup();
      }
    });
}
