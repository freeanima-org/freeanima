import { useEffect, useState, type JSX } from "react";
import { PlusIcon, TagIcon, XIcon } from "lucide-react";

import { Button, Input } from "@freeanima/frontend/ui-kit";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@freeanima/frontend/ui-kit/components/ui/dropdown-menu.tsx";
import { createTag, fetchTags, type TagRow } from "@freeanima/features/tag/ui/spa/lib/api.ts";

export type TaskTagKnown = { id: number; title: string };

type TaskTagPickerProps = {
  tagIds: number[];
  onChange: (tagIds: number[]) => void;
  /** 新建标签成功后同步给父层，避免筛选栏/行内标题滞后显示裸 id */
  onTagKnown?: (tag: TaskTagKnown) => void;
};

export function TaskTagPicker({ tagIds, onChange, onTagKnown }: TaskTagPickerProps): JSX.Element {
  const [pool, setPool] = useState<TagRow[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchTags()
      .then((tags) => {
        if (!cancelled) setPool(tags);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = pool.filter((t) => tagIds.includes(t.id));
  const hasTags = tagIds.length > 0;

  async function handleCreate(): Promise<void> {
    const title = draft.trim();
    if (!title) return;
    setError(null);
    try {
      const item = await createTag(title);
      setPool((prev) =>
        [...prev, item].toSorted(
          (a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title) || a.id - b.id,
        ),
      );
      onTagKnown?.({ id: item.id, title: item.title });
      if (!tagIds.includes(item.id)) onChange([...tagIds, item.id]);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function toggle(id: number, checked: boolean): void {
    if (checked) {
      if (!tagIds.includes(id)) onChange([...tagIds, id]);
      return;
    }
    onChange(tagIds.filter((x) => x !== id));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {selected.map((tag) => (
          <button
            key={tag.id}
            type="button"
            className="bg-muted text-muted-foreground hover:bg-muted/80 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs"
            onClick={() => toggle(tag.id, false)}
            aria-label={`移除标签 ${tag.title}`}
          >
            {tag.title}
            <XIcon className="size-3" />
          </button>
        ))}

        <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground h-7 gap-1 px-2 text-xs"
              aria-label="管理标签"
            >
              <TagIcon className="size-3.5" />
              {hasTags ? "标签" : "添加标签"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 p-2">
            <DropdownMenuLabel className="px-1">标签</DropdownMenuLabel>
            <div className="mb-2 flex gap-1">
              <Input
                className="h-8"
                value={draft}
                placeholder="新建标签"
                aria-label="新建标签名称"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleCreate();
                  }
                }}
              />
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                aria-label="创建标签"
                onClick={() => void handleCreate()}
              >
                <PlusIcon className="size-4" />
              </Button>
            </div>
            <DropdownMenuSeparator />
            {pool.length === 0 ? (
              <p className="text-muted-foreground px-1 py-2 text-xs">暂无标签</p>
            ) : (
              pool.map((tag) => (
                <DropdownMenuCheckboxItem
                  key={tag.id}
                  checked={tagIds.includes(tag.id)}
                  onCheckedChange={(checked) => toggle(tag.id, checked === true)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {tag.title}
                </DropdownMenuCheckboxItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
