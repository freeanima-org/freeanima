import { openEntityResource } from "@freeanima/client/portal-sdk/open-entity-resource.ts";
import {
  detachShellQuick,
  type ShellQuickEntry,
} from "@freeanima/client/portal-sdk/shell-quick.ts";
import {
  useActionSheetCapability,
  useContextMenuCapability,
  useShellQuickEntries,
} from "@freeanima/client/portal-sdk/react.tsx";
import { cn } from "@freeanima/ui-kit";
import { ActionSheet, ContextMenu } from "@freeanima/ui-kit/composite";
import type { ActionSheetItem } from "@freeanima/ui-kit/composite";
import { FolderKanban, ListTodo, Mail, BookOpen, StickyNote } from "lucide-react";
import { useCallback, useState, type ComponentType, type SVGProps } from "react";

type QuickIcon = ComponentType<SVGProps<SVGSVGElement>>;

function iconFor(entry: ShellQuickEntry): QuickIcon {
  switch (entry.primary_component) {
    case "project":
      return FolderKanban;
    case "task_list":
      return ListTodo;
    case "note":
      return StickyNote;
    case "diary_entry":
      return BookOpen;
    case "email_account":
      return Mail;
    default:
      return StickyNote;
  }
}

function openQuick(entry: ShellQuickEntry): void {
  void openEntityResource({
    id: entry.id,
    component: entry.primary_component,
    present: "navigate",
  });
}

function menuItemsFor(entry: ShellQuickEntry, onDone?: () => void): ActionSheetItem[] {
  return [
    {
      label: "打开",
      onClick: () => {
        openQuick(entry);
        onDone?.();
      },
    },
    {
      label: "移出快捷",
      danger: true,
      onClick: () => {
        void detachShellQuick(entry.id).catch(() => {
          /* ignore */
        });
        onDone?.();
      },
    },
  ];
}

export function ShellQuickRailSection({ expanded }: { expanded: boolean }) {
  const entries = useShellQuickEntries();
  const contextMenuEnabled = useContextMenuCapability();
  const useActionSheet = useActionSheetCapability();
  const [sheet, setSheet] = useState<{ title: string; items: ActionSheetItem[] } | null>(null);

  const onEntryActivate = useCallback((entry: ShellQuickEntry) => {
    openQuick(entry);
  }, []);

  if (entries.length === 0) return null;

  return (
    <div className="app-rail-quick shrink-0 min-h-0 flex flex-col border-t border-border mt-1 pt-1">
      {expanded ? (
        <div className="app-rail-quick-heading px-2 py-1 text-xs text-muted-foreground">快捷</div>
      ) : null}
      <nav
        className="app-rail-quick-nav flex min-h-0 flex-col gap-0.5 overflow-y-auto px-2 pb-1"
        aria-label="快捷"
      >
        {entries.map((entry) => {
          const Icon = iconFor(entry);
          const label = entry.title.trim() || `#${entry.id}`;
          const items = menuItemsFor(entry);

          if (contextMenuEnabled) {
            return (
              <ContextMenu key={entry.id} items={items}>
                <button
                  type="button"
                  className={cn(
                    "app-rail-nav-item w-full hover:bg-foreground/5 hover:text-foreground",
                  )}
                  aria-label={label}
                  title={expanded ? undefined : label}
                  onClick={() => onEntryActivate(entry)}
                >
                  <Icon className="app-rail-nav-icon" aria-hidden />
                  <span className="app-rail-nav-label">{label}</span>
                </button>
              </ContextMenu>
            );
          }

          return (
            <button
              key={entry.id}
              type="button"
              className={cn("app-rail-nav-item w-full hover:bg-foreground/5 hover:text-foreground")}
              aria-label={label}
              title={expanded ? undefined : label}
              onClick={() => onEntryActivate(entry)}
              onContextMenu={
                useActionSheet
                  ? (e) => {
                      e.preventDefault();
                      setSheet({
                        title: label,
                        items: menuItemsFor(entry, () => setSheet(null)),
                      });
                    }
                  : undefined
              }
            >
              <Icon className="app-rail-nav-icon" aria-hidden />
              <span className="app-rail-nav-label">{label}</span>
            </button>
          );
        })}
      </nav>
      {sheet ? (
        <ActionSheet title={sheet.title} items={sheet.items} onClose={() => setSheet(null)} />
      ) : null}
    </div>
  );
}

export function ShellQuickMoreSection({ onNavigate }: { onNavigate: () => void }) {
  const entries = useShellQuickEntries();
  if (entries.length === 0) return null;

  return (
    <div className="border-b border-border py-1" role="group" aria-label="快捷">
      <div className="px-4 py-1 text-xs text-muted-foreground">快捷</div>
      {entries.map((entry) => {
        const Icon = iconFor(entry);
        const label = entry.title.trim() || `#${entry.id}`;
        return (
          <button
            key={entry.id}
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted"
            onPointerDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openQuick(entry);
              onNavigate();
            }}
          >
            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
