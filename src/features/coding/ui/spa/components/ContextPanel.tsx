import { cn } from "@freeanima/ui-kit";
import type { ReactNode } from "react";

export type ContextTab = "files" | "preview" | "changes" | "terminals";

const TABS: Array<{ id: ContextTab; label: string }> = [
  { id: "files", label: "Files" },
  { id: "preview", label: "Preview" },
  { id: "changes", label: "Changes" },
  { id: "terminals", label: "Terminals" },
];

type Props = {
  tab: ContextTab;
  onTabChange: (tab: ContextTab) => void;
  badge?: Partial<Record<ContextTab, number>>;
  children: ReactNode;
};

export function ContextPanel({ tab, onTabChange, badge, children }: Props) {
  return (
    <aside className="coding-pane coding-context" aria-label="上下文">
      <div className="coding-context-tabs" role="tablist">
        {TABS.map((t) => {
          const count = badge?.[t.id];
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={cn("coding-context-tab", tab === t.id && "active")}
              onClick={() => onTabChange(t.id)}
            >
              {t.label}
              {count != null && count > 0 ? (
                <span className="coding-context-badge">{count}</span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="coding-context-body" role="tabpanel">
        {children}
      </div>
    </aside>
  );
}
