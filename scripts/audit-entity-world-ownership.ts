#!/usr/bin/env bun
/**
 * 只读：通用数据完整性检查（CLI）。
 * 用法：DATABASE_URL=… bun scripts/audit-entity-world-ownership.ts
 *
 * 逻辑与数据维护页「数据完整性」共用
 * `@freeanima/habitat/core/db/pg/data-integrity`。
 */
import { resolveWorldSubjectIds } from "@freeanima/habitat/core/config/worlds.ts";
import { initDatabase } from "@freeanima/habitat/core/db/pg/index.ts";
import { runIntegrityChecks } from "@freeanima/habitat/core/db/pg/data-integrity/index.ts";
import { RuntimeConfigStore } from "@freeanima/habitat/platform/config/runtime-config-store.ts";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  initDatabase({ getDatabaseUrl: () => url });

  let configuredSubjects: ReturnType<typeof resolveWorldSubjectIds> | undefined;
  try {
    configuredSubjects = resolveWorldSubjectIds((await RuntimeConfigStore.open()).data);
  } catch {
    configuredSubjects = undefined;
  }

  const report =
    configuredSubjects != null
      ? await runIntegrityChecks({ configuredSubjects })
      : await runIntegrityChecks();

  for (const issue of report.issues) {
    console.error(
      `[${issue.code}] ${issue.message}${issue.entity_id != null ? ` (entity ${issue.entity_id})` : ""}`,
    );
  }

  if (!report.ok) {
    console.error(`audit failed (${report.issue_count} issues, ${report.entity_count} entities)`);
    process.exit(1);
  }

  console.log(`audit ok (${report.entity_count} entities)`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
