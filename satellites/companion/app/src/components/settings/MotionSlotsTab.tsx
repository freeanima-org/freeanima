import { MOTION_SLOT_IDS, MOTION_SLOT_LABELS } from "@shared/companion-schema.ts";
import { setMotionSlot, uploadLocomotionMotion } from "@/lib/api.ts";
import { useCompanionStore } from "@/stores/companion.ts";
import { emitConfigChanged } from "@/lib/tauri.ts";
import { useRef, useState, type ChangeEvent } from "react";
import type { LocomotionSlot } from "@shared/constants.ts";

const LOCOMOTION_IMPORT_SLOTS = ["walk", "climb"] as const satisfies readonly LocomotionSlot[];

export function MotionSlotsTab() {
  const motionSlots = useCompanionStore((s) => s.motionSlots);
  const motionLibrary = useCompanionStore((s) => s.motionLibrary);
  const refreshConfig = useCompanionStore((s) => s.refreshConfig);
  const [importing, setImporting] = useState<LocomotionSlot | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const toggle = (slot: (typeof MOTION_SLOT_IDS)[number], motionId: string): void => {
    const current = motionSlots[slot] ?? [];
    const next = current.includes(motionId)
      ? current.filter((id) => id !== motionId)
      : [...current, motionId];
    void setMotionSlot(slot, next)
      .then(() => refreshConfig())
      .then(() => emitConfigChanged());
  };

  const onLocomotionImport =
    (slot: LocomotionSlot) =>
    async (ev: ChangeEvent<HTMLInputElement>): Promise<void> => {
      const file = ev.target.files?.[0];
      ev.target.value = "";
      if (!file) return;
      setImporting(slot);
      try {
        await uploadLocomotionMotion(slot, file);
        await refreshConfig();
        await emitConfigChanged();
      } finally {
        setImporting(null);
      }
    };

  return (
    <div className="space-y-3 max-h-[60vh] overflow-y-auto">
      <p className="text-xs text-white/40">
        为每个动作槽位勾选 0..n 个动作；播放时未指定则随机选取。纵向移动使用 <code>climb</code>{" "}
        槽位。
      </p>
      {LOCOMOTION_IMPORT_SLOTS.map((slot) => (
        <div
          key={`import-${slot}`}
          className="rounded-lg bg-white/5 p-2 flex flex-wrap gap-2 items-center"
        >
          <span className="text-xs text-white/70">{MOTION_SLOT_LABELS[slot]} — 导入</span>
          <input
            ref={(el) => {
              fileRefs.current[`${slot}:vrma`] = el;
            }}
            type="file"
            accept=".vrma,.fbx"
            className="hidden"
            onChange={(e) => void onLocomotionImport(slot)(e)}
          />
          <button
            type="button"
            className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/15"
            disabled={importing === slot}
            onClick={() => fileRefs.current[`${slot}:vrma`]?.click()}
          >
            {importing === slot ? "导入中…" : "VRMA / FBX"}
          </button>
        </div>
      ))}
      {MOTION_SLOT_IDS.map((slot) => (
        <div key={slot} className="rounded-lg bg-white/5 p-2">
          <p className="text-sm font-medium mb-2">{MOTION_SLOT_LABELS[slot]}</p>
          {motionLibrary.length === 0 ? (
            <p className="text-xs text-white/40">请先在动作库导入动作</p>
          ) : (
            <ul className="space-y-1">
              {motionLibrary.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={(motionSlots[slot] ?? []).includes(m.id)}
                    onChange={() => toggle(slot, m.id)}
                  />
                  <span>{m.name}</span>
                  <span className="text-white/35">({m.file})</span>
                </label>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
