import { useCompanionStore } from "@/stores/companion.ts";
import type { CompanionBehavior } from "@shared/companion-schema.ts";

export function BehaviorTab() {
  const behavior = useCompanionStore((s) => s.behavior);
  const updateSettings = useCompanionStore((s) => s.updateSettings);

  const patch = (p: Partial<CompanionBehavior>): void => {
    void updateSettings({ behavior: { ...behavior, ...p } });
  };

  return (
    <div className="space-y-3 text-sm">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={behavior.patrol_enabled}
          onChange={(e) => patch({ patrol_enabled: e.target.checked })}
        />
        空闲自动巡逻
      </label>
      <div>
        <label htmlFor="idle-delay">空闲延迟（秒）</label>
        <input
          id="idle-delay"
          type="number"
          min={30}
          value={behavior.idle_patrol_delay_sec}
          onChange={(e) => patch({ idle_patrol_delay_sec: Number(e.target.value) || 180 })}
        />
      </div>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={behavior.double_click_patrol}
          onChange={(e) => patch({ double_click_patrol: e.target.checked })}
        />
        双击角色进入巡逻
      </label>
      <div>
        <label htmlFor="patrol-pause">角点停顿（秒）</label>
        <input
          id="patrol-pause"
          type="number"
          min={0}
          value={behavior.patrol_pause_sec}
          onChange={(e) => patch({ patrol_pause_sec: Number(e.target.value) || 10 })}
        />
      </div>
      <div>
        <label htmlFor="patrol-speed">巡逻速度（px/s）</label>
        <input
          id="patrol-speed"
          type="number"
          min={20}
          value={behavior.patrol_speed_px}
          onChange={(e) => patch({ patrol_speed_px: Number(e.target.value) || 95 })}
        />
      </div>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={behavior.startup_walk_enabled}
          onChange={(e) => patch({ startup_walk_enabled: e.target.checked })}
        />
        启动时从屏幕中心走到左上角
      </label>
    </div>
  );
}
