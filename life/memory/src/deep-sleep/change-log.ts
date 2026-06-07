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
        ? ` → ${t.id} (${t.type}) "${t.content}" sources=${sourceLabel(t.source_sessions)} observed=${t.observed_at?.slice(0, 19) ?? "?"}`
        : "";
      return `${entry.id} — 已被合并${info}`;
    }
    case "deprecated":
      return `${entry.id} — 已过期/废弃（${entry.detail}）`;
    case "modified":
      return `${entry.id} — 已修改：${entry.detail}`;
    case "added": {
      const t = entry.mergedTarget;
      const info = t
        ? ` "${t.content}" sources=${sourceLabel(t.source_sessions)} observed=${t.observed_at?.slice(0, 19) ?? "?"}`
        : "";
      return `${entry.id} (${t?.type ?? "?"})${info}`;
    }
  }
}

/** 将变更日志渲染为消息1.5 文本 */
export function formatChangeLogMessage(log: DeepSleepChangeLog): string {
  if (log.deprecatedIds.length === 0 && log.addedIds.length === 0 && log.modifiedIds.length === 0) {
    return "（本深睡尚未执行任何变更）";
  }

  const lines: string[] = ["# 增量变更（以本内容为准）"];

  if (log.deprecatedIds.length > 0) {
    lines.push("");
    lines.push("## 已处理（请忽略消息1中的以下原始条目）");
    for (const id of log.deprecatedIds) {
      const entry = log.entries[id];
      if (entry) lines.push(entryToLine(entry));
    }
  }

  if (log.modifiedIds.length > 0) {
    lines.push("");
    lines.push("## 已修改条目（以本内容为准，覆盖消息1中的原始版本）");
    for (const id of log.modifiedIds) {
      const entry = log.entries[id];
      if (entry) lines.push(entryToLine(entry));
    }
  }

  if (log.addedIds.length > 0) {
    lines.push("");
    lines.push("## 新增条目（未在消息1中出现）");
    for (const id of log.addedIds) {
      const entry = log.entries[id];
      if (entry) lines.push(entryToLine(entry));
    }
  }

  return lines.join("\n");
}
