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
import { GripVerticalIcon, Trash2Icon } from "lucide-react";
import { Button, Textarea } from "@freeanima/frontend/ui-kit";

import type { BlockDraft, EntryDraft } from "../lib/entry-draft-dirty.ts";

export type EntrySaveStatus = "idle" | "saving" | "saved" | "error";

function SortableBlock({
  block,
  readOnly,
  onChange,
  onDelete,
}: {
  block: BlockDraft;
  readOnly: boolean;
  onChange: (content: string) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    disabled: readOnly,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group border-border/60 flex gap-1 rounded-md border border-transparent px-1 py-1 hover:border-border"
    >
      {!readOnly ? (
        <button
          type="button"
          className="text-muted-foreground mt-2 h-6 w-6 shrink-0 cursor-grab touch-none opacity-0 group-hover:opacity-100"
          aria-label="拖拽排序"
          {...attributes}
          {...listeners}
        >
          <GripVerticalIcon className="size-4" />
        </button>
      ) : null}
      <Textarea
        className="min-h-16 w-full flex-1 resize-none border-0 bg-transparent px-0 font-mono text-sm leading-relaxed shadow-none focus-visible:ring-0"
        value={block.content}
        onChange={(e) => onChange(e.target.value)}
        placeholder="写点什么…"
        aria-label="正文块"
        readOnly={readOnly}
      />
      {!readOnly ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground mt-1 h-7 w-7 shrink-0 p-0 opacity-0 group-hover:opacity-100"
          aria-label="删除块"
          onClick={onDelete}
        >
          <Trash2Icon className="size-3.5" />
        </Button>
      ) : null}
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
                  onChange={(content) =>
                    setBlocks(draft.blocks.map((b) => (b.id === block.id ? { ...b, content } : b)))
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
