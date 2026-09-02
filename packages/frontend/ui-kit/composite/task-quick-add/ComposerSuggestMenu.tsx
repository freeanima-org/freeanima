import { useEffect, useRef, type PointerEvent } from "react";
import { ListBox, ListBoxItem, type Key } from "react-aria-components";

import { Popover } from "../../components/ui/popover.tsx";
import { cn } from "../../lib/utils.ts";

export type ComposerSuggestEntry = {
  key: string;
  primary: string;
  secondary: string | null;
};

type ComposerSuggestMenuProps = {
  open: boolean;
  triggerRef: React.RefObject<HTMLElement | null>;
  ariaLabel: string;
  entries: ComposerSuggestEntry[];
  selectedKey: string | null;
  emptyLabel: string;
  onSelect: (key: string) => void;
};

export function ComposerSuggestMenu({
  open,
  triggerRef,
  ariaLabel,
  entries,
  selectedKey,
  emptyLabel,
  onSelect,
}: ComposerSuggestMenuProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !selectedKey) return;
    requestAnimationFrame(() => {
      listRef.current
        ?.querySelector('[data-selected="true"]')
        ?.scrollIntoView({ block: "nearest" });
    });
  }, [open, selectedKey, entries]);

  return (
    <Popover
      triggerRef={triggerRef}
      isOpen={open}
      isNonModal
      placement="top start"
      offset={4}
      className="w-(--trigger-width) overflow-hidden p-0"
    >
      <ListBox
        ref={listRef}
        aria-label={ariaLabel}
        selectedKeys={selectedKey ? [selectedKey] : []}
        selectionMode="single"
        className="max-h-48 overflow-y-auto p-1 outline-hidden"
        onAction={(key: Key) => {
          if (typeof key === "string") onSelect(key);
        }}
      >
        {entries.length === 0 ? (
          <ListBoxItem
            id="__empty"
            isDisabled
            textValue={emptyLabel}
            className="text-muted-foreground px-3 py-2 text-sm"
          >
            {emptyLabel}
          </ListBoxItem>
        ) : (
          entries.map((entry) => (
            <ListBoxItem
              key={entry.key}
              id={entry.key}
              textValue={entry.primary}
              className={cn(
                "flex w-full cursor-default items-baseline gap-2 rounded-md px-2 py-2 text-sm outline-hidden select-none",
                "data-selected:bg-primary/15 data-focused:bg-primary/15",
              )}
              onPointerDown={(e: PointerEvent) => e.preventDefault()}
            >
              <span className="shrink-0 font-medium font-mono">{entry.primary}</span>
              {entry.secondary ? (
                <span className="text-muted-foreground truncate text-xs">{entry.secondary}</span>
              ) : null}
            </ListBoxItem>
          ))
        )}
      </ListBox>
    </Popover>
  );
}
