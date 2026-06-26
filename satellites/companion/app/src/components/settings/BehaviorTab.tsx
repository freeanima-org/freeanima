import { FormFieldLabel, FormFieldset, FormToggle } from "@freeanima/satellite-sdk/form";
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
          <FormFieldset bordered={false} className="gap-1">
            <FormToggle
              label="空闲自动巡逻"
              checked={behavior.patrol_enabled}
              onChange={(checked) => patch({ patrol_enabled: checked })}
            />
            <FormToggle
              label="双击角色进入巡逻"
              checked={behavior.double_click_patrol}
              onChange={(checked) => patch({ double_click_patrol: checked })}
            />
            <FormToggle
              label="启动时从屏幕中心走到左上角"
              checked={behavior.startup_walk_enabled}
              onChange={(checked) => patch({ startup_walk_enabled: checked })}
            />
          </FormFieldset>
        </div>
      </div>

      <FormFieldset legend="巡逻参数" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <FormFieldLabel htmlFor="idle-delay">空闲延迟（秒）</FormFieldLabel>
          <input
            id="idle-delay"
            type="number"
            min={30}
            className="input input-bordered input-sm w-full"
            value={behavior.idle_patrol_delay_sec}
            onChange={(e) => patch({ idle_patrol_delay_sec: Number(e.target.value) || 180 })}
          />
        </div>
        <div>
          <FormFieldLabel htmlFor="patrol-pause">角点停顿（秒）</FormFieldLabel>
          <input
            id="patrol-pause"
            type="number"
            min={0}
            className="input input-bordered input-sm w-full"
            value={behavior.patrol_pause_sec}
            onChange={(e) => patch({ patrol_pause_sec: Number(e.target.value) || 10 })}
          />
        </div>
        <div className="sm:col-span-2">
          <FormFieldLabel htmlFor="patrol-speed">巡逻速度（px/s）</FormFieldLabel>
          <input
            id="patrol-speed"
            type="number"
            min={20}
            className="input input-bordered input-sm w-full"
            value={behavior.patrol_speed_px}
            onChange={(e) => patch({ patrol_speed_px: Number(e.target.value) || 95 })}
          />
        </div>
      </FormFieldset>
    </div>
  );
}
