import { useMemo, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardTitle,
  Checkbox,
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Spinner,
} from "@freeanima/ui-kit";
import type {
  MotionLibraryEntry,
  MotionSlotId,
} from "@freeanima/features/companion/shared/companion-schema.ts";
import {
  MOTION_SLOT_IDS,
  MOTION_SLOT_LABELS,
} from "@freeanima/features/companion/shared/companion-schema.ts";
import { setMotionSlot } from "@freeanima/features/companion/ui/spa/lib/api.ts";
import { useCompanionStore } from "@freeanima/features/companion/ui/spa/stores/companion.ts";
import { emitConfigChanged } from "@freeanima/features/companion/ui/spa/lib/portal-shell.ts";

type AddModalProps = {
  slot: MotionSlotId;
  onClose: () => void;
};

function SlotAddModal({ slot, onClose }: AddModalProps) {
  const motionSlots = useCompanionStore((s) => s.motionSlots);
  const motionLibrary = useCompanionStore((s) => s.motionLibrary);
  const refreshConfig = useCompanionStore((s) => s.refreshConfig);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const assigned = useMemo(() => new Set(motionSlots[slot] ?? []), [motionSlots, slot]);
  const available = useMemo(
    () => motionLibrary.filter((m) => !assigned.has(m.object_file_id)),
    [motionLibrary, assigned],
  );

  const toggle = (objectFileId: number): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(objectFileId)) next.delete(objectFileId);
      else next.add(objectFileId);
      return next;
    });
  };

  const confirm = (): void => {
    if (selected.size === 0) return;
    setSaving(true);
    const next = [...(motionSlots[slot] ?? []), ...selected];
    void setMotionSlot(slot, next)
      .then(() => refreshConfig())
      .then(() => emitConfigChanged())
      .then(() => onClose())
      .finally(() => setSaving(false));
  };

  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      showCloseButton={false}
      className="max-w-md"
    >
      <DialogHeader>
        <DialogTitle>添加到 {MOTION_SLOT_LABELS[slot]}</DialogTitle>
      </DialogHeader>
      <p className="text-xs text-foreground/55">从动作库选择尚未关联到此槽位的动作（可多选）</p>
      {available.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">没有可添加的动作</p>
      ) : (
        <ul className="flex flex-col gap-1 max-h-[40vh] overflow-y-auto pr-1">
          {available.map((m) => (
            <li key={m.object_file_id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg py-2 hover:bg-muted/50">
                <Checkbox
                  checked={selected.has(m.object_file_id)}
                  onCheckedChange={() => toggle(m.object_file_id)}
                />
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-sm">{m.name}</span>
                  <span className="block truncate text-xs text-foreground/45">
                    #{m.object_file_id}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          取消
        </Button>
        <Button type="button" disabled={selected.size === 0 || saving} onClick={confirm}>
          {saving ? <Spinner className="size-4" /> : null}
          {saving ? "添加中…" : `添加 (${selected.size})`}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

function motionEntry(
  library: MotionLibraryEntry[],
  objectFileId: number,
): MotionLibraryEntry | undefined {
  return library.find((m) => m.object_file_id === objectFileId);
}

export function MotionSlotsTab() {
  const motionSlots = useCompanionStore((s) => s.motionSlots);
  const motionLibrary = useCompanionStore((s) => s.motionLibrary);
  const refreshConfig = useCompanionStore((s) => s.refreshConfig);
  const [addSlot, setAddSlot] = useState<MotionSlotId | null>(null);

  const remove = (slot: MotionSlotId, objectFileId: number): void => {
    const next = (motionSlots[slot] ?? []).filter((id) => id !== objectFileId);
    void setMotionSlot(slot, next)
      .then(() => refreshConfig())
      .then(() => emitConfigChanged());
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-foreground/55 leading-relaxed">
        每个槽位可绑定多个动作；播放时未指定则随机选取。完整列表在「动作库」Tab（共{" "}
        {motionLibrary.length} 个）；此处只显示已绑定到槽位的动作。
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {MOTION_SLOT_IDS.map((slot) => {
          const ids = motionSlots[slot] ?? [];
          const entries = ids
            .map((id) => motionEntry(motionLibrary, id))
            .filter((m): m is MotionLibraryEntry => Boolean(m));

          return (
            <Card key={slot} className="gap-0 border bg-muted/30 py-0 shadow-none">
              <CardContent className="flex flex-col gap-2 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm">{MOTION_SLOT_LABELS[slot]}</CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setAddSlot(slot)}
                    disabled={motionLibrary.length === 0}
                  >
                    添加
                  </Button>
                </div>
                {entries.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-1">暂无动作</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border">
                    {entries.map((m) => (
                      <li
                        key={m.object_file_id}
                        className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{m.name}</p>
                          <p className="truncate text-xs text-foreground/45">#{m.object_file_id}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 shrink-0 px-2 text-xs text-destructive hover:text-destructive"
                          onClick={() => remove(slot, m.object_file_id)}
                        >
                          移除
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      {addSlot ? <SlotAddModal slot={addSlot} onClose={() => setAddSlot(null)} /> : null}
    </div>
  );
}
