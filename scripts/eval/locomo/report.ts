import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { LocomoReport } from "./types.ts";

function fmtRate(n: number | null): string {
  if (n == null) return "N/A";
  return `${(n * 100).toFixed(1)}%`;
}

export function reportToMarkdown(report: LocomoReport): string {
  const lines: string[] = [
    `# LoCoMo Eval Report`,
    ``,
    `- generated_at: ${report.generated_at}`,
    `- dry_run: ${report.dry_run}`,
    `- samples: ${report.sample_ids.join(", ") || "(none)"}`,
    `- qa_pairs: ${report.qa_count}`,
    ``,
    `## Overall`,
    ``,
    `| Metric | Value |`,
    `| --- | --- |`,
    `| Token 节省率 | ${fmtRate(report.overall.token_savings_rate)} |`,
    `| 质量保持率 | ${fmtRate(report.overall.quality_retention_rate)} |`,
    `| Baseline prompt tokens | ${report.overall.baseline_prompt_tokens} |`,
    `| FreeAnima prompt tokens | ${report.overall.freeanima_prompt_tokens} |`,
    `| Baseline quality (mean) | ${report.overall.baseline_quality.toFixed(3)} |`,
    `| FreeAnima quality (mean) | ${report.overall.freeanima_quality.toFixed(3)} |`,
    ``,
    `## By category`,
    ``,
    `| Cat | Name | N | Token savings | Quality retention |`,
    `| --- | --- | --- | --- | --- |`,
  ];
  for (const c of report.by_category) {
    lines.push(
      `| ${c.category} | ${c.name} | ${c.n} | ${fmtRate(c.token_savings_rate)} | ${fmtRate(c.quality_retention_rate)} |`,
    );
  }
  lines.push(``);
  return lines.join("\n");
}

export async function writeReport(opts: {
  report: LocomoReport;
  outDir: string;
  basename?: string;
}): Promise<{ jsonPath: string; mdPath: string }> {
  await mkdir(opts.outDir, { recursive: true });
  const base = opts.basename ?? `locomo-${Date.now()}`;
  const jsonPath = path.join(opts.outDir, `${base}.json`);
  const mdPath = path.join(opts.outDir, `${base}.md`);
  await writeFile(jsonPath, JSON.stringify(opts.report, null, 2), "utf8");
  await writeFile(mdPath, reportToMarkdown(opts.report), "utf8");
  return { jsonPath, mdPath };
}
