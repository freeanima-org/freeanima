/**
 * LoCoMo Eval CLI（由 run.ts 在设置 FREEANIMA_HOME 后动态加载）
 */
import path from "node:path";

import { answerBaseline } from "./arms/baseline.ts";
import { answerFreeanima } from "./arms/freeanima.ts";
import { fetchLocomoData, loadFixture } from "./fetch-data.ts";
import { createEvalMemoryHarness, ingestSampleInMemory, ingestSamplePg } from "./ingest.ts";
import { buildReport } from "./metrics.ts";
import { beginLocomoPgRuntime, type LocomoPgRuntime } from "./pg-runtime.ts";
import { reportToMarkdown, writeReport } from "./report.ts";
import { resolveLocomoModel } from "./env.ts";
import type { ArmAnswer, ArmName, LocomoSample } from "./types.ts";
import type { MemoryService } from "@freeanima/habitat/capabilities/memory/service";

type CliOpts = {
  dryRun: boolean;
  fixture: boolean;
  /** 强制 in-memory（不连 compose）；默认 dry-run=true 时 in-memory，否则 PG */
  memoryOnly: boolean;
  limit: number | null;
  sampleIds: string[] | null;
  arms: ArmName[];
  outDir: string;
  model: string;
  fetch: boolean;
};

function parseArgs(argv: string[], repoRoot: string): CliOpts {
  const opts: CliOpts = {
    dryRun: false,
    fixture: false,
    memoryOnly: false,
    limit: null,
    sampleIds: null,
    arms: ["baseline", "freeanima"],
    outDir: path.join(repoRoot, "scripts", "eval", "locomo", "out"),
    model: resolveLocomoModel(),
    fetch: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--fixture") opts.fixture = true;
    else if (a === "--memory-only") opts.memoryOnly = true;
    else if (a === "--fetch") opts.fetch = true;
    else if (a === "--limit") {
      opts.limit = Number(argv[++i] ?? "0") || null;
    } else if (a === "--sample-ids") {
      const raw = argv[++i] ?? "";
      opts.sampleIds = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (a === "--arm") {
      const v = argv[++i] ?? "";
      if (v === "baseline" || v === "freeanima") opts.arms = [v];
    } else if (a === "--out") {
      opts.outDir = path.resolve(argv[++i] ?? opts.outDir);
    } else if (a === "--model") {
      opts.model = argv[++i] ?? opts.model;
    } else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  return opts;
}

function printHelp(): void {
  console.log(`LoCoMo Eval Adapter（风巢 #16041）

Usage:
  bun scripts/eval/locomo/run.ts [options]

真实指标（推荐）:
  docker compose -f scripts/eval/locomo/compose.yaml up -d
  LOCOMO_API_KEY=... bun scripts/eval/locomo/run.ts --fixture --limit 5

Options:
  --dry-run          不调外网 LLM；假 retain 抽取 + 启发式裁判
  --fixture          使用 fixtures/mini.json
  --memory-only      强制 in-memory（不连 PG；仅冒烟接线）
  --fetch            强制重新拉取官方 locomo10.json
  --limit N          最多 N 条 QA
  --sample-ids a,b   仅这些 sample_id
  --arm baseline|freeanima
  --out DIR
  --model ID

环境（不读写用户 ~/.anima/config.yaml）:
  FREEANIMA_HOME     由 run.ts 设为 .cache/locomo/home
  LOCOMO_PG_URL      默认 postgres://locomo:locomo@127.0.0.1:55432/locomo
  LOCOMO_REDIS_URL   默认 redis://127.0.0.1:56379/0
  LOCOMO_API_KEY     OpenCode Go Key（或 OPENAI_API_KEY）
  LOCOMO_BASE_URL    默认 https://opencode.ai/zen/go/v1
  LOCOMO_MODEL       默认 deepseek-v4-flash
`);
}

function selectQa(
  samples: LocomoSample[],
  opts: CliOpts,
): Array<{ sample: LocomoSample; qaIndex: number }> {
  let filtered = samples;
  if (opts.sampleIds?.length) {
    const set = new Set(opts.sampleIds);
    filtered = samples.filter((s) => set.has(s.sample_id));
  }
  const pairs: Array<{ sample: LocomoSample; qaIndex: number }> = [];
  for (const sample of filtered) {
    for (let i = 0; i < sample.qa.length; i++) {
      pairs.push({ sample, qaIndex: i });
      if (opts.limit != null && pairs.length >= opts.limit) return pairs;
    }
  }
  return pairs;
}

export async function main(repoRoot: string): Promise<void> {
  const opts = parseArgs(process.argv.slice(2), repoRoot);
  const realPg = !opts.memoryOnly;

  if (realPg) {
    console.log(
      "[locomo] PG 模式：hybrid FTS recall；config 仅写入 FREEANIMA_HOME=.cache/locomo/home",
    );
  } else {
    console.log("[locomo] memory-only：in-memory + 关键词召回（非真实指标）");
  }
  if (opts.dryRun) {
    console.log("[locomo] dry-run：不调外网 LLM");
  }

  let samples: LocomoSample[];
  if (opts.fixture) {
    samples = await loadFixture(repoRoot);
    console.log(`[locomo] fixture samples=${samples.length}`);
  } else {
    try {
      const fetched = await fetchLocomoData({ repoRoot, force: opts.fetch });
      samples = fetched.samples;
      console.log(`[locomo] data=${fetched.path} samples=${samples.length}`);
    } catch (e) {
      if (opts.dryRun) {
        console.warn(`[locomo] fetch failed (${String(e)}); falling back to fixture`);
        samples = await loadFixture(repoRoot);
      } else {
        throw e;
      }
    }
  }

  const pairs = selectQa(samples, opts);
  if (pairs.length === 0) {
    throw new Error("no QA selected; check --sample-ids / --limit / data");
  }

  const needFreeanima = opts.arms.includes("freeanima");
  const needBaseline = opts.arms.includes("baseline");
  const sampleIds = [...new Set(pairs.map((p) => p.sample.sample_id))];

  let pgRuntime: LocomoPgRuntime | null = null;
  const serviceBySample = new Map<
    string,
    { service: MemoryService; transcript: string; retained: number }
  >();

  try {
    if (realPg) {
      const home = process.env.FREEANIMA_HOME;
      if (!home) throw new Error("FREEANIMA_HOME unset; use scripts/eval/locomo/run.ts");
      pgRuntime = await beginLocomoPgRuntime({ home, dryRun: opts.dryRun });
      for (const sid of sampleIds) {
        const sample = samples.find((s) => s.sample_id === sid);
        if (!sample) continue;
        const ingested = await ingestSamplePg({ sample, service: pgRuntime.service });
        serviceBySample.set(sid, {
          service: pgRuntime.service,
          transcript: ingested.transcript,
          retained: ingested.retained,
        });
        console.log(
          `[locomo] PG ingest ${sid}: turns=${ingested.turns.length} retained=${ingested.retained}`,
        );
      }
    } else {
      for (const sid of sampleIds) {
        const sample = samples.find((s) => s.sample_id === sid);
        if (!sample) continue;
        const harness = createEvalMemoryHarness();
        const ingested = await ingestSampleInMemory({ sample, harness });
        serviceBySample.set(sid, {
          service: harness.service,
          transcript: ingested.transcript,
          retained: ingested.retained,
        });
        console.log(
          `[locomo] mem ingest ${sid}: turns=${ingested.turns.length} retained=${ingested.retained}`,
        );
      }
    }

    const answers: ArmAnswer[] = [];
    for (const { sample, qaIndex } of pairs) {
      const qa = sample.qa[qaIndex];
      if (!qa) continue;
      const ingested = serviceBySample.get(sample.sample_id);
      if (!ingested) continue;

      if (needBaseline) {
        const a = await answerBaseline({
          sample,
          qa,
          questionIndex: qaIndex,
          transcript: ingested.transcript,
          dryRun: opts.dryRun,
          model: opts.model,
        });
        answers.push(a);
        console.log(
          `[baseline] ${sample.sample_id}#${qaIndex} tok=${a.prompt_tokens} q=${a.quality}`,
        );
      }
      if (needFreeanima) {
        const a = await answerFreeanima({
          sample,
          qa,
          questionIndex: qaIndex,
          service: ingested.service,
          dryRun: opts.dryRun,
          realRecall: realPg,
          model: opts.model,
        });
        answers.push(a);
        console.log(
          `[freeanima] ${sample.sample_id}#${qaIndex} tok=${a.prompt_tokens} q=${a.quality}`,
        );
      }
    }

    const report = buildReport({
      answers,
      dry_run: opts.dryRun,
      sample_ids: sampleIds,
    });
    const { jsonPath, mdPath } = await writeReport({ report, outDir: opts.outDir });
    console.log(reportToMarkdown(report));
    console.log(`[locomo] wrote ${jsonPath}`);
    console.log(`[locomo] wrote ${mdPath}`);
  } finally {
    await pgRuntime?.teardown();
  }
}
