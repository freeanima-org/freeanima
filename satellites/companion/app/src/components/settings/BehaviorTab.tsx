import { useCompanionStore } from "@/stores/companion.ts";
import type { CompanionBehavior } from "@shared/companion-schema.ts";

export function BehaviorTab() {
  const behavior = useCompanionStore((s) => s.behavior);
  const updateSettings = useCompanionStore((s) => s.updateSettings);

  const patch = (p: Partial<CompanionBehavior>): void => {
    void updateSettings({ behavior: { ...behavior, ...p } });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="card card-border bg-base-300/30">
        <div className="card-body gap-2 py-4">
          <label className="label cursor-pointer justify-start gap-3 py-1">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={behavior.patrol_enabled}
              onChange={(e) => patch({ patrol_enabled: e.target.checked })}
            />
            <span className="label-text">空闲自动巡逻</span>
          </label>
          <label className="label cursor-pointer justify-start gap-3 py-1">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={behavior.double_click_patrol}
              onChange={(e) => patch({ double_click_patrol: e.target.checked })}
            />
            <span className="label-text">双击角色进入巡逻</span>
          </label>
          <label className="label cursor-pointer justify-start gap-3 py-1">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={behavior.startup_walk_enabled}
              onChange={(e) => patch({ startup_walk_enabled: e.target.checked })}
            />
            <span className="label-text">启动时从屏幕中心走到左上角</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="form-control">
          <label className="label py-1" htmlFor="idle-delay">
            <span className="label-text">空闲延迟（秒）</span>
          </label>
          <input
            id="idle-delay"
            type="number"
            min={30}
            className="input input-bordered input-sm"
            value={behavior.idle_patrol_delay_sec}
            onChange={(e) => patch({ idle_patrol_delay_sec: Number(e.target.value) || 180 })}
          />
        </div>
        <div className="form-control">
          <label className="label py-1" htmlFor="patrol-pause">
            <span className="label-text">角点停顿（秒）</span>
          </label>
          <input
            id="patrol-pause"
            type="number"
            min={0}
            className="input input-bordered input-sm"
            value={behavior.patrol_pause_sec}
            onChange={(e) => patch({ patrol_pause_sec: Number(e.target.value) || 10 })}
          />
        </div>
        <div className="form-control sm:col-span-2">
          <label className="label py-1" htmlFor="patrol-speed">
            <span className="label-text">巡逻速度（px/s）</span>
          </label>
          <input
            id="patrol-speed"
            type="number"
            min={20}
            className="input input-bordered input-sm"
            value={behavior.patrol_speed_px}
            onChange={(e) => patch({ patrol_speed_px: Number(e.target.value) || 95 })}
          />
        </div>
      </div>
    </div>
  );
}
