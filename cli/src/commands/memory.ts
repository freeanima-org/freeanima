import type { Command } from "commander";
import { bootstrapMemoryJobs } from "@freeanima/service/bootstrap-memory-jobs";
import { runLightSleepBackfill } from "@freeanima/capabilities-memory/light-sleep/backfill";

export function registerMemoryCommand(program: Command): void {
  const memory = program.command("memory").description("Memory pipeline CLI");

  const sleep = memory.command("sleep").description("Light sleep / deep sleep batch processing");

  sleep
    .command("backfill")
    .description("Backfill light sleep by CST calendar days (from earliest session to yesterday)")
    .option("--from <day>", "Start day YYYY-MM-DD (default earliest session day)")
    .option("--to <day>", "End day YYYY-MM-DD (default yesterday CST)")
    .option("--resume", "Resume from ~/.anima/runtime/light_sleep_backfill_state.json")
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
