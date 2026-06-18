import { useMemo, useState } from "react";
import type { MotionLibraryEntry, MotionSlotId } from "@shared/companion-schema.ts";
import { MOTION_SLOT_IDS, MOTION_SLOT_LABELS } from "@shared/companion-schema.ts";
import { setMotionSlot } from "@/lib/api.ts";
import { useCompanionStore } from "@/stores/companion.ts";
import { emitConfigChanged } from "@/lib/tauri.ts";

type AddModalProps = {
  slot: MotionSlotId;
  onClose: () => void;
};

function SlotAddModal({ slot, onClose }: AddModalProps) {
  const motionSlots = useCompanionStore((s) => s.motionSlots);
  const motionLibrary = useCompanionStore((s) => s.motionLibrary);
  const refreshConfig = useCompanionStore((s) => s.refreshConfig);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const assigned = useMemo(() => new Set(motionSlots[slot] ?? []), [motionSlots, slot]);
  const available = useMemo(
    () => motionLibrary.filter((m) => !assigned.has(m.id)),
    [motionLibrary, assigned],
  );

  const toggle = (id: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
    <dialog className="modal modal-open">
      <div className="modal-box max-w-md">
        <h3 className="font-semibold text-base">添加到 {MOTION_SLOT_LABELS[slot]}</h3>
        <p className="text-xs text-base-content/55 mt-2 mb-4">
          从动作库选择尚未关联到此槽位的动作（可多选）
        </p>
        {available.length === 0 ? (
          <p className="text-sm text-base-content/50 py-4">没有可添加的动作</p>
        ) : (
          <ul className="flex flex-col gap-1 max-h-[40vh] overflow-y-auto pr-1">
            {available.map((m) => (
              <li key={m.id}>
                <label className="label cursor-pointer justify-start gap-3 py-2 rounded-lg hover:bg-base-300/50">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={selected.has(m.id)}
                    onChange={() => toggle(m.id)}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-sm">{m.name}</span>
                    <span className="block truncate text-xs text-base-content/45" title={m.id}>
                      {m.id}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={selected.size === 0 || saving}
            onClick={confirm}
          >
            {saving ? <span className="loading loading-spinner loading-sm" /> : null}
            {saving ? "添加中…" : `添加 (${selected.size})`}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose}>
          关闭
        </button>
      </form>
    </dialog>
  );
}

function motionEntry(library: MotionLibraryEntry[], id: string): MotionLibraryEntry | undefined {
  return library.find((m) => m.id === id);
}

export function MotionSlotsTab() {
  const motionSlots = useCompanionStore((s) => s.motionSlots);
  const motionLibrary = useCompanionStore((s) => s.motionLibrary);
  const refreshConfig = useCompanionStore((s) => s.refreshConfig);
  const [addSlot, setAddSlot] = useState<MotionSlotId | null>(null);

  const remove = (slot: MotionSlotId, motionId: string): void => {
    const next = (motionSlots[slot] ?? []).filter((id) => id !== motionId);
    void setMotionSlot(slot, next)
      .then(() => refreshConfig())
      .then(() => emitConfigChanged());
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-base-content/55 leading-relaxed">
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
            <section key={slot} className="card card-border bg-base-300/30">
              <div className="card-body py-3 px-4 gap-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="card-title text-sm">{MOTION_SLOT_LABELS[slot]}</h3>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => setAddSlot(slot)}
                    disabled={motionLibrary.length === 0}
                  >
                    添加
                  </button>
                </div>
                {entries.length === 0 ? (
                  <p className="text-xs text-base-content/50 py-1">暂无动作</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-base-content/5">
                    {entries.map((m) => (
                      <li key={m.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{m.name}</p>
                          <p className="truncate text-xs text-base-content/45" title={m.id}>
                            {m.id}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs text-error shrink-0"
                          onClick={() => remove(slot, m.id)}
                        >
                          移除
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          );
        })}
      </div>
      {addSlot ? <SlotAddModal slot={addSlot} onClose={() => setAddSlot(null)} /> : null}
    </div>
  );
}
