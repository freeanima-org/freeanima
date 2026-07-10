import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");

const SYMBOL_MODULE: Record<string, string> = {
  CompressionState: "@freeanima/core/db/domain",
  ConversationMessage: "@freeanima/core/db/domain",
  StoredMessage: "@freeanima/core/db/domain",
  ConversationMetaMessage: "@freeanima/core/db/domain",
  ConversationTodoStore: "@freeanima/core/db/domain",
  isAssistantMessage: "@freeanima/core/db/domain",
  isConversationMeta: "@freeanima/core/db/domain",
  isSystemMessage: "@freeanima/core/db/domain",
  isToolMessage: "@freeanima/core/db/domain",
  isUserMessage: "@freeanima/core/db/domain",
  SelfBlockRow: "@freeanima/core/db/schema/rows",
  LimbicMemoryRow: "@freeanima/core/db/schema/rows",
  SemanticMemoryRow: "@freeanima/core/db/schema/rows",
  SemanticFtsHit: "@freeanima/core/db/schema/rows",
  AutobiographicalMemoryRow: "@freeanima/core/db/schema/rows",
  CronJobRow: "@freeanima/core/db/schema/rows",
  NotificationRow: "@freeanima/core/db/schema/rows",
  SapInstanceRow: "@freeanima/core/db/schema/rows",
  ConversationSummaryRow: "@freeanima/core/db/pg/conversation/types",
  ConversationListOpts: "@freeanima/core/db/pg/conversation/types",
  MessageFtsHit: "@freeanima/core/db/pg/conversation/types",
  MessageRowView: "@freeanima/core/db/pg/conversation/types",
  ConversationCleanupResult: "@freeanima/core/db/pg/conversation/types",
  SemanticMemoryCreateInput: "@freeanima/core/db/pg/semantic-memory/types",
  SemanticMemoryUpdateInput: "@freeanima/core/db/pg/semantic-memory/types",
  SemanticMemorySearchOpts: "@freeanima/core/db/pg/semantic-memory/types",
  SemanticMemorySortBy: "@freeanima/core/db/pg/semantic-memory/types",
  RESIDENT_PINNED_MAX: "@freeanima/core/db/pg/semantic-memory/types",
  RESIDENT_TOP_N: "@freeanima/core/db/pg/semantic-memory/types",
  semanticFtsHitSchema: "@freeanima/core/db/pg/semantic-memory/types",
  semanticMemoryRowSchema: "@freeanima/core/db/pg/semantic-memory/types",
  SelfBlockKey: "@freeanima/core/db/pg/self-layer/types",
  SelfBlockUpsertInput: "@freeanima/core/db/pg/self-layer/types",
  SelfBlockUpdateInput: "@freeanima/core/db/pg/self-layer/types",
  SELF_BLOCK_KEYS: "@freeanima/core/db/pg/self-layer/types",
  AutobiographicalSignificance: "@freeanima/core/db/pg/autobiographical-memory/types",
  AutobiographicalStatus: "@freeanima/core/db/pg/autobiographical-memory/types",
  AutobiographicalMemoryCreateInput: "@freeanima/core/db/pg/autobiographical-memory/types",
  AutobiographicalListOrder: "@freeanima/core/db/pg/autobiographical-memory/types",
  AutobiographicalListOpts: "@freeanima/core/db/pg/autobiographical-memory/types",
  AutobiographicalFtsHit: "@freeanima/core/db/pg/autobiographical-memory/types",
  LimbicKind: "@freeanima/core/db/pg/limbic-memory/types",
  LimbicMemoryCreateInput: "@freeanima/core/db/pg/limbic-memory/types",
  LimbicListOpts: "@freeanima/core/db/pg/limbic-memory/types",
  LimbicListByConversationsOpts: "@freeanima/core/db/pg/limbic-memory/types",
  LimbicListByCreatedOpts: "@freeanima/core/db/pg/limbic-memory/types",
  LimbicFtsHit: "@freeanima/core/db/pg/limbic-memory/types",
  CronJobCreateInput: "@freeanima/core/db/pg/cron/types",
  CronJobBuiltinUpsertInput: "@freeanima/core/db/pg/cron/types",
  CronJobUpdateInput: "@freeanima/core/db/pg/cron/types",
  CronLogRow: "@freeanima/core/db/pg/cron/types",
  CronLogAppendInput: "@freeanima/core/db/pg/cron/types",
  CronLogListOpts: "@freeanima/core/db/pg/cron/types",
  PipelineStepRunRow: "@freeanima/core/db/pg/pipeline/types",
  PipelineStepRunAppendInput: "@freeanima/core/db/pg/pipeline/types",
  PipelineStepRunListOpts: "@freeanima/core/db/pg/pipeline/types",
  AutoLlmRunRow: "@freeanima/core/db/pg/auto-llm-run/types",
  AutoLlmRunAppendInput: "@freeanima/core/db/pg/auto-llm-run/types",
  PurgeStaleAutoLlmRunsOpts: "@freeanima/core/db/pg/auto-llm-run/types",
  AutoLlmRunListOpts: "@freeanima/core/db/pg/auto-llm-run/types",
  AutoLlmRunCountOpts: "@freeanima/core/db/pg/auto-llm-run/types",
  NotificationCreateInput: "@freeanima/core/db/pg/notifications/types",
  NotificationListOpts: "@freeanima/core/db/pg/notifications/types",
  NotificationRecipientKind: "@freeanima/core/db/pg/notifications/types",
  NotificationReadFilter: "@freeanima/core/db/pg/notifications/types",
  NotificationSourceKind: "@freeanima/core/db/pg/notifications/types",
  NOTIFICATION_RECIPIENT_KINDS: "@freeanima/core/db/pg/notifications/types",
  NOTIFICATION_READ_FILTERS: "@freeanima/core/db/pg/notifications/types",
  NOTIFICATION_SOURCE_KINDS: "@freeanima/core/db/pg/notifications/types",
  DEFAULT_NOTIFICATION_RECIPIENT_ID: "@freeanima/core/db/pg/notifications/types",
  MemoryReferenceRow: "@freeanima/core/db/pg/memory-reference/types",
  RecordMessageReferencesInput: "@freeanima/core/db/pg/memory-reference/types",
  EntityRow: "@freeanima/core/db/pg/entity/types",
  EntityCreateInput: "@freeanima/core/db/pg/entity/types",
  EntityUpdateInput: "@freeanima/core/db/pg/entity/types",
  EntityListOpts: "@freeanima/core/db/pg/entity/types",
  EntitySearchMode: "@freeanima/core/db/pg/entity/types",
  EntitySearchOpts: "@freeanima/core/db/pg/entity/types",
  EntitySearchHit: "@freeanima/core/db/pg/entity/types",
  EntitySearchResult: "@freeanima/core/db/pg/entity/types",
  SapInstanceUpsertInput: "@freeanima/core/db/pg/sap/types",
  SEMANTIC_MEMORY_ID_PATTERN: "@freeanima/core/db/pg/memory-reference/markers",
  MEMORY_REFERENCE_MARKER_RE: "@freeanima/core/db/pg/memory-reference/markers",
  formatMemoryReferenceMarker: "@freeanima/core/db/pg/memory-reference/markers",
  formatResidentMemoryLine: "@freeanima/core/db/pg/memory-reference/markers",
  parseMemoryReferenceMarkers: "@freeanima/core/db/pg/memory-reference/markers",
  MEMORY_REFERENCE_CITATION_RULE: "@freeanima/core/db/pg/memory-reference/markers",
  MEMORY_SEMANTIC_CITATION_TOOL_HINT: "@freeanima/core/db/pg/memory-reference/markers",
  MEMORY_REFERENCE_RECENT_WEIGHT: "@freeanima/core/db/pg/memory-reference/markers",
  MEMORY_REFERENCE_STALE_WEIGHT: "@freeanima/core/db/pg/memory-reference/markers",
  MEMORY_REFERENCE_DECAY_DAYS: "@freeanima/core/db/pg/memory-reference/markers",
  memoryReferenceWeight: "@freeanima/core/db/pg/memory-reference/markers",
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
    'from "@freeanima/core/db/pg/memory-reference/markers"',
  );
  src = src.replace(
    /from\s+["']@freeanima\/core\/repos\/schemas\/semantic-memory-row\.ts["']/g,
    'from "@freeanima/core/db/pg/semantic-memory/types"',
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
    'import "@freeanima/core/db/pg/semantic-memory/types"',
  );

  src = src.replace(
    /import\(["']@freeanima\/core\/repos["']\)/g,
    'import("@freeanima/core/db/pg/semantic-memory/types")',
  );

  src = src.replace(
    /import\(["']@freeanima\/core\/repos["']\)\.(\w+)/g,
    'import("@freeanima/core/db/pg/semantic-memory/types").$1',
  );

  src = src.replace(
    /import\("@freeanima\/core\/repos"\)\.(\w+)/g,
    'import("@freeanima/core/db/pg/semantic-memory/types").$1',
  );

  src = src.replace(
    /import\("@freeanima\/core\/repos"\)/g,
    'import("@freeanima/core/db/pg/semantic-memory/types")',
  );

  src = src.replace(
    /:\s*import\("@freeanima\/core\/repos"\)\.(\w+)/g,
    ': import("@freeanima/core/db/pg/cron/types").$1',
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
