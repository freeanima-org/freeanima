import type { DeepSleepChangeLog, DeepSleepChangeEntry } from "./types.ts";

function sourceLabel(sources: string[]): string {
  if (!sources.length) return "[]";
  return `[${sources.join(", ")}]`;
}

function entryToLine(entry: DeepSleepChangeEntry): string {
  switch (entry.action) {
    case "merged_into": {
      const t = entry.mergedTarget;
      const info = t
        ? ` → ${t.id} (${t.type}) "${t.content}" sources=${sourceLabel(t.source_conversations)} observed=${t.observed_at?.slice(0, 19) ?? "?"}`
        : "";
      return `${entry.id} — merged${info}`;
    }
    case "deprecated":
      return `${entry.id} — expired/deprecated (${entry.detail})`;
    case "modified":
      return `${entry.id} — modified: ${entry.detail}`;
    case "added": {
      const t = entry.mergedTarget;
      const info = t
        ? ` "${t.content}" sources=${sourceLabel(t.source_conversations)} observed=${t.observed_at?.slice(0, 19) ?? "?"}`
        : "";
      return `${entry.id} (${t?.type ?? "?"})${info}`;
    }
  }
}

/** Render change log as message 1.5 text */
export function formatChangeLogMessage(log: DeepSleepChangeLog): string {
  if (log.deprecatedIds.length === 0 && log.addedIds.length === 0 && log.modifiedIds.length === 0) {
    return "(No changes applied yet in this deep sleep run)";
  }

  const lines: string[] = ["# Incremental changes (authoritative over message 1)"];

  if (log.deprecatedIds.length > 0) {
    lines.push("");
    lines.push("## Processed (ignore these original entries in message 1)");
    for (const id of log.deprecatedIds) {
      const entry = log.entries[id];
      if (entry) lines.push(entryToLine(entry));
    }
  }

  if (log.modifiedIds.length > 0) {
    lines.push("");
    lines.push("## Modified entries (authoritative; override message 1 originals)");
    for (const id of log.modifiedIds) {
      const entry = log.entries[id];
      if (entry) lines.push(entryToLine(entry));
    }
  }

  if (log.addedIds.length > 0) {
    lines.push("");
    lines.push("## New entries (not present in message 1)");
    for (const id of log.addedIds) {
      const entry = log.entries[id];
      if (entry) lines.push(entryToLine(entry));
    }
  }

  return lines.join("\n");
}
