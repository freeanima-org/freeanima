import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");

const SYMBOL_MODULE: Record<string, string> = {
  CompressionState: "@freeanima/habitat/core/db/domain",
  ConversationMessage: "@freeanima/habitat/core/db/domain",
  StoredMessage: "@freeanima/habitat/core/db/domain",
  ConversationMetaMessage: "@freeanima/habitat/core/db/domain",
  ConversationTodoStore: "@freeanima/habitat/core/db/domain",
  isAssistantMessage: "@freeanima/habitat/core/db/domain",
  isConversationMeta: "@freeanima/habitat/core/db/domain",
  isSystemMessage: "@freeanima/habitat/core/db/domain",
  isToolMessage: "@freeanima/habitat/core/db/domain",
  isUserMessage: "@freeanima/habitat/core/db/domain",
  SelfBlockRow: "@freeanima/habitat/core/db/schema/rows",
  LimbicMemoryRow: "@freeanima/habitat/core/db/schema/rows",
  SemanticMemoryRow: "@freeanima/habitat/core/db/schema/rows",
  SemanticFtsHit: "@freeanima/habitat/core/db/schema/rows",
  AutobiographicalMemoryRow: "@freeanima/habitat/core/db/schema/rows",
  CronJobRow: "@freeanima/habitat/core/db/schema/rows",
  NotificationRow: "@freeanima/habitat/core/db/schema/rows",
  OutpostInstanceRow: "@freeanima/habitat/core/db/schema/rows",
  ConversationSummaryRow: "@freeanima/habitat/core/db/pg/conversation/types",
  ConversationListOpts: "@freeanima/habitat/core/db/pg/conversation/types",
  MessageFtsHit: "@freeanima/habitat/core/db/pg/conversation/types",
  MessageRowView: "@freeanima/habitat/core/db/pg/conversation/types",
  ConversationCleanupResult: "@freeanima/habitat/core/db/pg/conversation/types",
  SemanticMemoryCreateInput: "@freeanima/habitat/core/db/pg/semantic-memory/types",
  SemanticMemoryUpdateInput: "@freeanima/habitat/core/db/pg/semantic-memory/types",
  SemanticMemorySearchOpts: "@freeanima/habitat/core/db/pg/semantic-memory/types",
  SemanticMemorySortBy: "@freeanima/habitat/core/db/pg/semantic-memory/types",
  RESIDENT_PINNED_MAX: "@freeanima/habitat/core/db/pg/semantic-memory/types",
  RESIDENT_TOP_N: "@freeanima/habitat/core/db/pg/semantic-memory/types",
  semanticFtsHitSchema: "@freeanima/habitat/core/db/pg/semantic-memory/types",
  semanticMemoryRowSchema: "@freeanima/habitat/core/db/pg/semantic-memory/types",
  SelfBlockKey: "@freeanima/habitat/core/db/pg/self-layer/types",
  SelfBlockUpsertInput: "@freeanima/habitat/core/db/pg/self-layer/types",
  SelfBlockUpdateInput: "@freeanima/habitat/core/db/pg/self-layer/types",
  SELF_BLOCK_KEYS: "@freeanima/habitat/core/db/pg/self-layer/types",
  AutobiographicalSignificance: "@freeanima/habitat/core/db/pg/autobiographical-memory/types",
  AutobiographicalStatus: "@freeanima/habitat/core/db/pg/autobiographical-memory/types",
  AutobiographicalListOrder: "@freeanima/habitat/core/db/pg/autobiographical-memory/types",
  AutobiographicalListOpts: "@freeanima/habitat/core/db/pg/autobiographical-memory/types",
  AutobiographicalFtsHit: "@freeanima/habitat/core/db/pg/autobiographical-memory/types",
  LimbicKind: "@freeanima/habitat/core/db/pg/limbic-memory/types",
  LimbicListOpts: "@freeanima/habitat/core/db/pg/limbic-memory/types",
  LimbicListByConversationsOpts: "@freeanima/habitat/core/db/pg/limbic-memory/types",
  LimbicListByCreatedOpts: "@freeanima/habitat/core/db/pg/limbic-memory/types",
  LimbicFtsHit: "@freeanima/habitat/core/db/pg/limbic-memory/types",
  CronJobCreateInput: "@freeanima/habitat/core/db/pg/cron/types",
  CronJobBuiltinUpsertInput: "@freeanima/habitat/core/db/pg/cron/types",
  CronJobUpdateInput: "@freeanima/habitat/core/db/pg/cron/types",
  CronLogRow: "@freeanima/habitat/core/db/pg/cron/types",
  CronLogAppendInput: "@freeanima/habitat/core/db/pg/cron/types",
  CronLogListOpts: "@freeanima/habitat/core/db/pg/cron/types",
  PipelineStepRunRow: "@freeanima/habitat/core/db/pg/pipeline/types",
  PipelineStepRunAppendInput: "@freeanima/habitat/core/db/pg/pipeline/types",
  PipelineStepRunListOpts: "@freeanima/habitat/core/db/pg/pipeline/types",
  AutoLlmRunRow: "@freeanima/habitat/core/db/pg/auto-llm-run/types",
  AutoLlmRunAppendInput: "@freeanima/habitat/core/db/pg/auto-llm-run/types",
  PurgeStaleAutoLlmRunsOpts: "@freeanima/habitat/core/db/pg/auto-llm-run/types",
  AutoLlmRunListOpts: "@freeanima/habitat/core/db/pg/auto-llm-run/types",
  AutoLlmRunCountOpts: "@freeanima/habitat/core/db/pg/auto-llm-run/types",
  NotificationCreateInput: "@freeanima/habitat/core/db/pg/notifications/types",
  NotificationListOpts: "@freeanima/habitat/core/db/pg/notifications/types",
  NotificationRecipientKind: "@freeanima/habitat/core/db/pg/notifications/types",
  NotificationReadFilter: "@freeanima/habitat/core/db/pg/notifications/types",
  NotificationSourceKind: "@freeanima/habitat/core/db/pg/notifications/types",
  NOTIFICATION_RECIPIENT_KINDS: "@freeanima/habitat/core/db/pg/notifications/types",
  NOTIFICATION_READ_FILTERS: "@freeanima/habitat/core/db/pg/notifications/types",
  NOTIFICATION_SOURCE_KINDS: "@freeanima/habitat/core/db/pg/notifications/types",
  DEFAULT_NOTIFICATION_RECIPIENT_ID: "@freeanima/habitat/core/db/pg/notifications/types",
  MemoryReferenceRow: "@freeanima/habitat/core/db/pg/memory-reference/types",
  RecordMessageReferencesInput: "@freeanima/habitat/core/db/pg/memory-reference/types",
  EntityRow: "@freeanima/habitat/core/db/pg/entity/types",
  EntityCreateInput: "@freeanima/habitat/core/db/pg/entity/types",
  EntityUpdateInput: "@freeanima/habitat/core/db/pg/entity/types",
  EntityListOpts: "@freeanima/habitat/core/db/pg/entity/types",
  EntitySearchMode: "@freeanima/habitat/core/db/pg/entity/types",
  EntitySearchOpts: "@freeanima/habitat/core/db/pg/entity/types",
  EntitySearchHit: "@freeanima/habitat/core/db/pg/entity/types",
  EntitySearchResult: "@freeanima/habitat/core/db/pg/entity/types",
  OutpostInstanceUpsertInput: "@freeanima/habitat/core/db/pg/outpost/types",
  MEMORY_REFERENCE_MARKER_RE: "@freeanima/habitat/core/db/pg/memory-reference/markers",
  formatMemoryReferenceMarker: "@freeanima/habitat/core/db/pg/memory-reference/markers",
  formatResidentMemoryLine: "@freeanima/habitat/core/db/pg/memory-reference/markers",
  parseMemoryReferenceMarkers: "@freeanima/habitat/core/db/pg/memory-reference/markers",
  MEMORY_REFERENCE_CITATION_RULE: "@freeanima/habitat/core/db/pg/memory-reference/markers",
  MEMORY_SEMANTIC_CITATION_TOOL_HINT: "@freeanima/habitat/core/db/pg/memory-reference/markers",
  MEMORY_REFERENCE_RECENT_WEIGHT: "@freeanima/habitat/core/db/pg/memory-reference/markers",
  MEMORY_REFERENCE_STALE_WEIGHT: "@freeanima/habitat/core/db/pg/memory-reference/markers",
  MEMORY_REFERENCE_DECAY_DAYS: "@freeanima/habitat/core/db/pg/memory-reference/markers",
  memoryReferenceWeight: "@freeanima/habitat/core/db/pg/memory-reference/markers",
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
    'from "@freeanima/habitat/core/db/pg/memory-reference/markers"',
  );
  src = src.replace(
    /from\s+["']@freeanima\/core\/repos\/schemas\/semantic-memory-row\.ts["']/g,
    'from "@freeanima/habitat/core/db/pg/semantic-memory/types"',
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
    'import "@freeanima/habitat/core/db/pg/semantic-memory/types"',
  );

  src = src.replace(
    /import\(["']@freeanima\/core\/repos["']\)/g,
    'import("@freeanima/habitat/core/db/pg/semantic-memory/types")',
  );

  src = src.replace(
    /import\(["']@freeanima\/core\/repos["']\)\.(\w+)/g,
    'import("@freeanima/habitat/core/db/pg/semantic-memory/types").$1',
  );

  src = src.replace(
    /import\("@freeanima\/core\/repos"\)\.(\w+)/g,
    'import("@freeanima/habitat/core/db/pg/semantic-memory/types").$1',
  );

  src = src.replace(
    /import\("@freeanima\/core\/repos"\)/g,
    'import("@freeanima/habitat/core/db/pg/semantic-memory/types")',
  );

  src = src.replace(
    /:\s*import\("@freeanima\/core\/repos"\)\.(\w+)/g,
    ': import("@freeanima/habitat/core/db/pg/cron/types").$1',
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
