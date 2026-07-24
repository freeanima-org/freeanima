import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");

const SYMBOL_MODULE: Record<string, string> = {
  CompressionState: "@freeanima/host/core/db/domain",
  ConversationMessage: "@freeanima/host/core/db/domain",
  StoredMessage: "@freeanima/host/core/db/domain",
  ConversationMetaMessage: "@freeanima/host/core/db/domain",
  ConversationTodoStore: "@freeanima/host/core/db/domain",
  isAssistantMessage: "@freeanima/host/core/db/domain",
  isConversationMeta: "@freeanima/host/core/db/domain",
  isSystemMessage: "@freeanima/host/core/db/domain",
  isToolMessage: "@freeanima/host/core/db/domain",
  isUserMessage: "@freeanima/host/core/db/domain",
  SelfBlockRow: "@freeanima/host/core/db/schema/rows",
  LimbicMemoryRow: "@freeanima/host/core/db/schema/rows",
  SemanticMemoryRow: "@freeanima/host/core/db/schema/rows",
  SemanticFtsHit: "@freeanima/host/core/db/schema/rows",
  AutobiographicalMemoryRow: "@freeanima/host/core/db/schema/rows",
  CronJobRow: "@freeanima/host/core/db/schema/rows",
  NotificationRow: "@freeanima/host/core/db/schema/rows",
  OutpostInstanceRow: "@freeanima/host/core/db/schema/rows",
  ConversationSummaryRow: "@freeanima/host/core/db/pg/conversation/types",
  ConversationListOpts: "@freeanima/host/core/db/pg/conversation/types",
  MessageFtsHit: "@freeanima/host/core/db/pg/conversation/types",
  MessageRowView: "@freeanima/host/core/db/pg/conversation/types",
  ConversationCleanupResult: "@freeanima/host/core/db/pg/conversation/types",
  SemanticMemoryCreateInput: "@freeanima/host/core/db/pg/semantic-memory/types",
  SemanticMemoryUpdateInput: "@freeanima/host/core/db/pg/semantic-memory/types",
  SemanticMemorySearchOpts: "@freeanima/host/core/db/pg/semantic-memory/types",
  SemanticMemorySortBy: "@freeanima/host/core/db/pg/semantic-memory/types",
  RESIDENT_PINNED_MAX: "@freeanima/host/core/db/pg/semantic-memory/types",
  RESIDENT_TOP_N: "@freeanima/host/core/db/pg/semantic-memory/types",
  semanticFtsHitSchema: "@freeanima/host/core/db/pg/semantic-memory/types",
  semanticMemoryRowSchema: "@freeanima/host/core/db/pg/semantic-memory/types",
  SelfBlockKey: "@freeanima/host/core/db/pg/self-layer/types",
  SelfBlockUpsertInput: "@freeanima/host/core/db/pg/self-layer/types",
  SelfBlockUpdateInput: "@freeanima/host/core/db/pg/self-layer/types",
  SELF_BLOCK_KEYS: "@freeanima/host/core/db/pg/self-layer/types",
  AutobiographicalSignificance: "@freeanima/host/core/db/pg/autobiographical-memory/types",
  AutobiographicalStatus: "@freeanima/host/core/db/pg/autobiographical-memory/types",
  AutobiographicalMemoryCreateInput: "@freeanima/host/core/db/pg/autobiographical-memory/types",
  AutobiographicalListOrder: "@freeanima/host/core/db/pg/autobiographical-memory/types",
  AutobiographicalListOpts: "@freeanima/host/core/db/pg/autobiographical-memory/types",
  AutobiographicalFtsHit: "@freeanima/host/core/db/pg/autobiographical-memory/types",
  LimbicKind: "@freeanima/host/core/db/pg/limbic-memory/types",
  LimbicMemoryCreateInput: "@freeanima/host/core/db/pg/limbic-memory/types",
  LimbicListOpts: "@freeanima/host/core/db/pg/limbic-memory/types",
  LimbicListByConversationsOpts: "@freeanima/host/core/db/pg/limbic-memory/types",
  LimbicListByCreatedOpts: "@freeanima/host/core/db/pg/limbic-memory/types",
  LimbicFtsHit: "@freeanima/host/core/db/pg/limbic-memory/types",
  CronJobCreateInput: "@freeanima/host/core/db/pg/cron/types",
  CronJobBuiltinUpsertInput: "@freeanima/host/core/db/pg/cron/types",
  CronJobUpdateInput: "@freeanima/host/core/db/pg/cron/types",
  CronLogRow: "@freeanima/host/core/db/pg/cron/types",
  CronLogAppendInput: "@freeanima/host/core/db/pg/cron/types",
  CronLogListOpts: "@freeanima/host/core/db/pg/cron/types",
  PipelineStepRunRow: "@freeanima/host/core/db/pg/pipeline/types",
  PipelineStepRunAppendInput: "@freeanima/host/core/db/pg/pipeline/types",
  PipelineStepRunListOpts: "@freeanima/host/core/db/pg/pipeline/types",
  AutoLlmRunRow: "@freeanima/host/core/db/pg/auto-llm-run/types",
  AutoLlmRunAppendInput: "@freeanima/host/core/db/pg/auto-llm-run/types",
  PurgeStaleAutoLlmRunsOpts: "@freeanima/host/core/db/pg/auto-llm-run/types",
  AutoLlmRunListOpts: "@freeanima/host/core/db/pg/auto-llm-run/types",
  AutoLlmRunCountOpts: "@freeanima/host/core/db/pg/auto-llm-run/types",
  NotificationCreateInput: "@freeanima/host/core/db/pg/notifications/types",
  NotificationListOpts: "@freeanima/host/core/db/pg/notifications/types",
  NotificationRecipientKind: "@freeanima/host/core/db/pg/notifications/types",
  NotificationReadFilter: "@freeanima/host/core/db/pg/notifications/types",
  NotificationSourceKind: "@freeanima/host/core/db/pg/notifications/types",
  NOTIFICATION_RECIPIENT_KINDS: "@freeanima/host/core/db/pg/notifications/types",
  NOTIFICATION_READ_FILTERS: "@freeanima/host/core/db/pg/notifications/types",
  NOTIFICATION_SOURCE_KINDS: "@freeanima/host/core/db/pg/notifications/types",
  DEFAULT_NOTIFICATION_RECIPIENT_ID: "@freeanima/host/core/db/pg/notifications/types",
  MemoryReferenceRow: "@freeanima/host/core/db/pg/memory-reference/types",
  RecordMessageReferencesInput: "@freeanima/host/core/db/pg/memory-reference/types",
  EntityRow: "@freeanima/host/core/db/pg/entity/types",
  EntityCreateInput: "@freeanima/host/core/db/pg/entity/types",
  EntityUpdateInput: "@freeanima/host/core/db/pg/entity/types",
  EntityListOpts: "@freeanima/host/core/db/pg/entity/types",
  EntitySearchMode: "@freeanima/host/core/db/pg/entity/types",
  EntitySearchOpts: "@freeanima/host/core/db/pg/entity/types",
  EntitySearchHit: "@freeanima/host/core/db/pg/entity/types",
  EntitySearchResult: "@freeanima/host/core/db/pg/entity/types",
  OutpostInstanceUpsertInput: "@freeanima/host/core/db/pg/outpost/types",
  MEMORY_REFERENCE_MARKER_RE: "@freeanima/host/core/db/pg/memory-reference/markers",
  formatMemoryReferenceMarker: "@freeanima/host/core/db/pg/memory-reference/markers",
  formatResidentMemoryLine: "@freeanima/host/core/db/pg/memory-reference/markers",
  parseMemoryReferenceMarkers: "@freeanima/host/core/db/pg/memory-reference/markers",
  MEMORY_REFERENCE_CITATION_RULE: "@freeanima/host/core/db/pg/memory-reference/markers",
  MEMORY_SEMANTIC_CITATION_TOOL_HINT: "@freeanima/host/core/db/pg/memory-reference/markers",
  MEMORY_REFERENCE_RECENT_WEIGHT: "@freeanima/host/core/db/pg/memory-reference/markers",
  MEMORY_REFERENCE_STALE_WEIGHT: "@freeanima/host/core/db/pg/memory-reference/markers",
  MEMORY_REFERENCE_DECAY_DAYS: "@freeanima/host/core/db/pg/memory-reference/markers",
  memoryReferenceWeight: "@freeanima/host/core/db/pg/memory-reference/markers",
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === "core/repos") continue;
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) walk(path, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

function parseSymbols(spec: string): string[] {
  return spec
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/^(?:type\s+)?(\w+)(?:\s+as\s+(\w+))?$/);
      if (!m?.[1]) throw new Error(`Unparsed import symbol: ${part}`);
      return m[1];
    });
}

function rewriteFile(path: string): boolean {
  let src = readFileSync(path, "utf8");
  const original = src;

  src = src.replace(
    /from\s+["']@freeanima\/core\/repos\/memory-reference\/markers["']/g,
    'from "@freeanima/host/core/db/pg/memory-reference/markers"',
  );
  src = src.replace(
    /from\s+["']@freeanima\/core\/repos\/schemas\/semantic-memory-row\.ts["']/g,
    'from "@freeanima/host/core/db/pg/semantic-memory/types"',
  );

  const importRe = /import\s+(type\s+)?\{([^}]+)\}\s+from\s+["']@freeanima\/core\/repos["'];?/g;
  src = src.replace(importRe, (_full, typeKw: string | undefined, body: string) => {
    const symbols = parseSymbols(body);
    const grouped = new Map<string, string[]>();
    for (const sym of symbols) {
      const mod = SYMBOL_MODULE[sym];
      if (!mod) throw new Error(`${path}: unknown symbol ${sym}`);
      const list = grouped.get(mod) ?? [];
      list.push(sym);
      grouped.set(mod, list);
    }
    const lines = [...grouped.entries()].map(([mod, syms]) => {
      const prefix = typeKw ? "import type" : "import";
      return `${prefix} { ${syms.join(", ")} } from "${mod}";`;
    });
    return lines.join("\n");
  });

  src = src.replace(
    /import\s+["']@freeanima\/core\/repos["']/g,
    'import "@freeanima/host/core/db/pg/semantic-memory/types"',
  );

  src = src.replace(
    /import\(["']@freeanima\/core\/repos["']\)/g,
    'import("@freeanima/host/core/db/pg/semantic-memory/types")',
  );

  src = src.replace(
    /import\(["']@freeanima\/core\/repos["']\)\.(\w+)/g,
    'import("@freeanima/host/core/db/pg/semantic-memory/types").$1',
  );

  src = src.replace(
    /import\("@freeanima\/core\/repos"\)\.(\w+)/g,
    'import("@freeanima/host/core/db/pg/semantic-memory/types").$1',
  );

  src = src.replace(
    /import\("@freeanima\/core\/repos"\)/g,
    'import("@freeanima/host/core/db/pg/semantic-memory/types")',
  );

  src = src.replace(
    /:\s*import\("@freeanima\/core\/repos"\)\.(\w+)/g,
    ': import("@freeanima/host/core/db/pg/cron/types").$1',
  );

  if (src !== original) {
    writeFileSync(path, src);
    return true;
  }
  return false;
}

let changed = 0;
for (const file of walk(ROOT)) {
  if (file.includes("/core/repos/")) continue;
  if (rewriteFile(file)) {
    changed += 1;
    console.log(file.replace(ROOT + "/", ""));
  }
}
console.log(`updated ${changed} files`);
