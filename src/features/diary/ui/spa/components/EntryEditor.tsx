import { useState } from "react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDownIcon, ChevronRightIcon, GripVerticalIcon, Trash2Icon } from "lucide-react";
import { useTouchPrimaryCapability } from "@freeanima/client/portal-sdk/react";
import { Button, Input, Textarea, cn } from "@freeanima/ui-kit";
import { ConfirmDialog } from "@freeanima/ui-kit/composite";

import type { BlockDraft, EntryDraft } from "../lib/entry-draft-dirty.ts";
import {
  firstContentParagraph,
  isBlockCollapsed,
  setBlockCollapsed,
} from "../lib/block-collapse.ts";
import { BlockTagPicker } from "./BlockTagPicker.tsx";

export type EntrySaveStatus = "idle" | "saving" | "saved" | "error";

function semanticLabelOf(components: string[]): string | null {
  if (components.includes("dream")) return "梦境";
  if (components.includes("limbic")) return "情绪";
  if (components.includes("narrative")) return "自传";
  return null;
}

function SortableBlock({
  block,
  readOnly,
  onChange,
  onDelete,
}: {
  block: BlockDraft;
  readOnly: boolean;
  onChange: (patch: Partial<Pick<BlockDraft, "title" | "content" | "tag_ids">>) => void;
  onDelete: () => void;
}) {
  const touchPrimary = useTouchPrimaryCapability();
  const hoverReveal = touchPrimary ? "" : "opacity-0 group-hover:opacity-100";
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    disabled: readOnly,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };
  const semanticLabel = semanticLabelOf(block.components);
  const blockReadOnly = readOnly || semanticLabel != null;
  const [collapsed, setCollapsed] = useState(() => isBlockCollapsed(block.id));
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    setBlockCollapsed(block.id, next);
  };

  const collapsedSummary = block.title.trim()
    ? block.title.trim()
    : firstContentParagraph(block.content) || "（空）";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group border-border/60 flex flex-col gap-1 rounded-md border border-transparent px-1 py-1 hover:border-border"
    >
      <div className="flex items-center gap-1 px-1">
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground h-6 w-6 shrink-0"
          aria-label={collapsed ? "展开块" : "收起块"}
          onClick={toggleCollapsed}
        >
          {collapsed ? (
            <ChevronRightIcon className="size-4" />
          ) : (
            <ChevronDownIcon className="size-4" />
          )}
        </button>

        {collapsed ? (
          <p className="text-foreground min-w-0 flex-1 truncate text-sm font-medium">
            {collapsedSummary}
          </p>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {blockReadOnly ? (
              block.title.trim() ? (
                <span className="text-foreground truncate text-sm font-medium">{block.title}</span>
              ) : null
            ) : (
              <Input
                className="text-foreground h-7 min-w-0 flex-1 border-0 bg-transparent px-0 text-sm font-medium shadow-none placeholder:text-muted-foreground/50 focus-visible:ring-0"
                value={block.title}
                onChange={(e) => onChange({ title: e.target.value })}
                placeholder="标题（可选）"
                aria-label="块标题"
              />
            )}
            {semanticLabel ? (
              <span className="bg-primary/10 text-primary shrink-0 rounded px-1.5 py-0.5 text-xs font-medium tracking-wide">
                {semanticLabel}
              </span>
            ) : null}
          </div>
        )}

        {!blockReadOnly && !collapsed ? (
          <button
            type="button"
            className={cn(
              "text-muted-foreground shrink-0 cursor-grab touch-none",
              touchPrimary ? "flex h-9 w-9 items-center justify-center" : "h-6 w-6",
              hoverReveal,
            )}
            aria-label="拖拽排序"
            {...attributes}
            {...listeners}
          >
            <GripVerticalIcon className="size-4" />
          </button>
        ) : null}
        {!blockReadOnly && !collapsed ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "text-muted-foreground shrink-0 p-0",
              touchPrimary ? "h-9 w-9" : "h-7 w-7",
              hoverReveal,
            )}
            aria-label="删除块"
            onClick={() => setConfirmDeleteOpen(true)}
          >
            <Trash2Icon className="size-3.5" />
          </Button>
        ) : null}
      </div>

      {!collapsed ? (
        <>
          <div className="flex gap-1 pl-7">
            <Textarea
              className="min-h-16 w-full flex-1 resize-none border-0 bg-transparent px-0 font-mono text-sm leading-relaxed shadow-none focus-visible:ring-0"
              value={block.content}
              onChange={(e) => onChange({ content: e.target.value })}
              placeholder="写点什么…"
              aria-label={semanticLabel ? `${semanticLabel}块` : "正文块"}
              readOnly={blockReadOnly}
            />
          </div>
          <div className="pl-7">
            <BlockTagPicker
              tagIds={block.tag_ids}
              onChange={(tag_ids) => onChange({ tag_ids })}
              alwaysShowTrigger={!blockReadOnly}
              readOnly={blockReadOnly}
            />
          </div>
        </>
      ) : null}

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="删除确认"
        description="确定删除该正文块？未保存前仍可放弃编辑恢复。"
        confirmLabel="删除"
        variant="error"
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          onDelete();
        }}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
}

export function EntryEditor({
  draft,
  onDraftChange,
  readOnly = false,
}: {
  draft: EntryDraft;
  onDraftChange: (draft: EntryDraft) => void;
  readOnly?: boolean;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const setBlocks = (blocks: BlockDraft[]) => {
    onDraftChange({ ...draft, blocks });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = draft.blocks.findIndex((b) => b.id === active.id);
    const newIndex = draft.blocks.findIndex((b) => b.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(draft.blocks, oldIndex, newIndex).map((block, index) => ({
      ...block,
      sort_order: index,
    }));
    setBlocks(reordered);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={draft.blocks.map((b) => b.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-1">
              {draft.blocks.map((block) => (
                <SortableBlock
                  key={block.id}
                  block={block}
                  readOnly={readOnly}
                  onChange={(patch) =>
                    setBlocks(draft.blocks.map((b) => (b.id === block.id ? { ...b, ...patch } : b)))
                  }
                  onDelete={() => setBlocks(draft.blocks.filter((b) => b.id !== block.id))}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        {draft.blocks.length === 0 ? (
          <p className="text-muted-foreground px-2 py-6 text-sm">暂无正文块</p>
        ) : null}
      </div>
    </div>
  );
}
