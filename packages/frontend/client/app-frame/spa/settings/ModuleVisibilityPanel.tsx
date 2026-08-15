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
import { Checkbox, Label, Slider } from "@freeanima/ui-kit";
import {
  SHELL_MODULE_LOCKED,
  type ShellModuleId,
} from "@freeanima/client/portal-sdk/shell-module-visibility";
import {
  useSetShellModuleOrder,
  useSetShellModulePrimaryCount,
  useSetShellModuleVisibility,
  useShellModuleOrder,
  useShellModulePrimaryCount,
  useShellModuleVisibility,
} from "@freeanima/client/portal-sdk/react.tsx";
import type { SettingsPanelProps } from "@freeanima/client/portal-sdk/settings";
import { GripVertical } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { isCompactLayout, useLayoutMode } from "../layout-mode.ts";
import {
  readAppBottomNavSafeAreaHorizontalPx,
  readAppBottomNavViewportWidthPx,
  resolveAppBottomNavAvailableWidth,
  resolveAppBottomNavMaxBarCount,
} from "../lib/app-bottom-nav-layout.ts";
import { appNavItems, orderedVisibleAppNavItems } from "../lib/app-nav-i18n.ts";

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
        isSelected={checked}
        isDisabled={locked}
        onChange={(value) => onToggle(value)}
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

function useBottomNavMaxBarCount(visibleCount: number): number {
  const [maxCount, setMaxCount] = useState(() => {
    const available = resolveAppBottomNavAvailableWidth(
      readAppBottomNavViewportWidthPx(),
      readAppBottomNavSafeAreaHorizontalPx(),
    );
    return resolveAppBottomNavMaxBarCount(available, visibleCount);
  });

  useEffect(() => {
    const sync = () => {
      const available = resolveAppBottomNavAvailableWidth(
        readAppBottomNavViewportWidthPx(),
        readAppBottomNavSafeAreaHorizontalPx(),
      );
      setMaxCount(resolveAppBottomNavMaxBarCount(available, visibleCount));
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, [visibleCount]);

  return maxCount;
}

export default function ModuleVisibilityPanel(_props: SettingsPanelProps) {
  const visible = useShellModuleVisibility();
  const setVisible = useSetShellModuleVisibility();
  const order = useShellModuleOrder();
  const setOrder = useSetShellModuleOrder();
  const primaryCount = useShellModulePrimaryCount();
  const setPrimaryCount = useSetShellModulePrimaryCount();
  const compact = isCompactLayout(useLayoutMode());

  const items = useMemo(() => {
    const navById = new Map(appNavItems().map((item) => [item.id, item]));
    return order
      .map((id) => navById.get(id))
      .filter((item): item is NonNullable<typeof item> => item != null);
  }, [order]);

  const visibleNavCount = useMemo(
    () => orderedVisibleAppNavItems(visible, order).length,
    [order, visible],
  );
  const maxBarCount = useBottomNavMaxBarCount(visibleNavCount);
  const displayPrimaryCount = Math.min(primaryCount ?? maxBarCount, maxBarCount);

  useEffect(() => {
    if (primaryCount == null) return;
    if (primaryCount > maxBarCount) setPrimaryCount(maxBarCount);
  }, [maxBarCount, primaryCount, setPrimaryCount]);

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
    <div className="space-y-4">
      {compact ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label id="shell-module-primary-count-label" className="text-sm">
              常用模块个数
            </Label>
            <span className="text-sm tabular-nums text-muted-foreground">
              {displayPrimaryCount}
            </span>
          </div>
          <Slider
            aria-labelledby="shell-module-primary-count-label"
            minValue={1}
            maxValue={maxBarCount}
            step={1}
            value={displayPrimaryCount}
            onChange={(n) => {
              const next = typeof n === "number" ? n : n[0];
              if (next == null || !Number.isFinite(next)) return;
              const clamped = Math.min(maxBarCount, Math.max(1, Math.floor(next)));
              setPrimaryCount(clamped);
            }}
          />
          <p className="text-xs text-muted-foreground">
            按上方顺序前 N 个平铺在底栏，其余收进「更多」。范围 1–{maxBarCount}（随屏幕宽度变化）。
          </p>
        </div>
      ) : null}
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
    </div>
  );
}
