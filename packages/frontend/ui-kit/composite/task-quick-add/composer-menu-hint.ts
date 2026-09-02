import { dateSlashPresetCommand, type DateSlashPreset } from "./date-slash-presets.ts";
import type { PriorityMenuEntry } from "./priority-options.ts";

export type ComposerMenuEntry =
  | { kind: "container"; key: string; label: string; section: string }
  | { kind: "tag"; key: string; label: string }
  | { kind: "priority"; key: string; label: string; data: PriorityMenuEntry }
  | { kind: "dateSlash"; key: string; label: string; data: DateSlashPreset };

export function composerMenuAriaLabel(kind: ComposerMenuEntry["kind"]): string {
  switch (kind) {
    case "container":
      return "选择清单或项目";
    case "tag":
      return "选择标签";
    case "priority":
      return "选择优先级";
    case "dateSlash":
      return "计划日期快捷";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function composerMenuPrimary(entry: ComposerMenuEntry): string {
  switch (entry.kind) {
    case "dateSlash":
      return dateSlashPresetCommand(entry.data);
    case "container":
      return `@${entry.label}`;
    case "tag":
      return `#${entry.label}`;
    case "priority":
      return `!${entry.label}`;
    default: {
      const _exhaustive: never = entry;
      throw new Error(`unknown composer menu entry: ${String(_exhaustive)}`);
    }
  }
}

export function composerMenuSecondary(entry: ComposerMenuEntry): string | null {
  if (entry.kind === "dateSlash") return entry.label;
  if (entry.kind === "container") return entry.section;
  if (entry.kind === "priority") {
    const en = entry.data.aliases.find((a) => /^[a-z]/i.test(a));
    return en ?? null;
  }
  return null;
}
