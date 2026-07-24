import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Checkbox, Label } from "@freeanima/ui-kit";
import {
  SHELL_MODULE_LOCKED,
  type ShellModuleId,
} from "@freeanima/client/portal-sdk/shell-module-visibility";
import {
  useSetShellModuleOrder,
  useSetShellModuleVisibility,
  useShellModuleOrder,
  useShellModuleVisibility,
} from "@freeanima/client/portal-sdk/react.tsx";
import type { SettingsPanelProps } from "@freeanima/client/portal-sdk/settings";
import { GripVertical } from "lucide-react";
import { useMemo } from "react";

import { appNavItems } from "../lib/app-nav-i18n.ts";

function SortableModuleRow({
  id,
  label,
  locked,
  checked,
  onToggle,
}: {
  id: ShellModuleId;
  label: string;
  locked: boolean;
  checked: boolean;
  onToggle: (checked: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const inputId = `shell-module-${id}`;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-3 ${isDragging ? "opacity-60" : ""}`}
    >
      <button
        type="button"
        className="mt-0.5 shrink-0 touch-none text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
        aria-label="拖拽调整顺序"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      <Checkbox
        id={inputId}
        checked={checked}
        disabled={locked}
        onCheckedChange={(value) => onToggle(value === true)}
      />
      <div className="min-w-0 flex-1">
        <Label
          htmlFor={inputId}
          className={locked ? "text-muted-foreground" : "cursor-pointer font-medium"}
        >
          {label}
        </Label>
        {locked ? <p className="text-xs text-muted-foreground mt-0.5">此模块不可关闭</p> : null}
      </div>
    </li>
  );
}

export default function ModuleVisibilityPanel(_props: SettingsPanelProps) {
  const visible = useShellModuleVisibility();
  const setVisible = useSetShellModuleVisibility();
  const order = useShellModuleOrder();
  const setOrder = useSetShellModuleOrder();

  const items = useMemo(() => {
    const navById = new Map(appNavItems().map((item) => [item.id, item]));
    return order
      .map((id) => navById.get(id))
      .filter((item): item is NonNullable<typeof item> => item != null);
  }, [order]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const toggle = (id: ShellModuleId, checked: boolean) => {
    const next = new Set(visible);
    if (checked) next.add(id);
    else next.delete(id);
    setVisible(next);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(active.id as ShellModuleId);
    const newIndex = order.indexOf(over.id as ShellModuleId);
    if (oldIndex < 0 || newIndex < 0) return;
    setOrder(arrayMove(order, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <ul className="space-y-3">
          {items.map((item) => (
            <SortableModuleRow
              key={item.id}
              id={item.id}
              label={item.label()}
              locked={SHELL_MODULE_LOCKED.includes(item.id)}
              checked={visible.has(item.id)}
              onToggle={(checked) => toggle(item.id, checked)}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
