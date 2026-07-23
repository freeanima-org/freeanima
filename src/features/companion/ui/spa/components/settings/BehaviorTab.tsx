import { Card, CardContent, Input } from "@freeanima/frontend/ui-kit";
import {
  FormFieldLabel,
  FormFieldset,
  FormToggle,
} from "@freeanima/frontend/ui-kit/form/FormFieldset.tsx";
import { useCompanionStore } from "@freeanima/features/companion/ui/spa/stores/companion.ts";
import type { CompanionBehavior } from "@freeanima/features/companion/shared/companion-schema.ts";

export function BehaviorTab() {
  const behavior = useCompanionStore((s) => s.behavior);
  const updateSettings = useCompanionStore((s) => s.updateSettings);

  const patch = (p: Partial<CompanionBehavior>): void => {
    void updateSettings({ behavior: { ...behavior, ...p } });
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-0 border bg-muted/30 py-0 shadow-none">
        <CardContent className="flex flex-col gap-2 px-4 py-4">
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
        </CardContent>
      </Card>

      <FormFieldset legend="巡逻参数" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <FormFieldLabel htmlFor="idle-delay">空闲延迟（秒）</FormFieldLabel>
          <Input
            id="idle-delay"
            type="number"
            min={30}
            className="h-8"
            value={behavior.idle_patrol_delay_sec}
            onChange={(e) => patch({ idle_patrol_delay_sec: Number(e.target.value) || 180 })}
          />
        </div>
        <div>
          <FormFieldLabel htmlFor="patrol-pause">角点停顿（秒）</FormFieldLabel>
          <Input
            id="patrol-pause"
            type="number"
            min={0}
            className="h-8"
            value={behavior.patrol_pause_sec}
            onChange={(e) => patch({ patrol_pause_sec: Number(e.target.value) || 10 })}
          />
        </div>
        <div className="sm:col-span-2">
          <FormFieldLabel htmlFor="patrol-speed">巡逻速度（px/s）</FormFieldLabel>
          <Input
            id="patrol-speed"
            type="number"
            min={20}
            className="h-8"
            value={behavior.patrol_speed_px}
            onChange={(e) => patch({ patrol_speed_px: Number(e.target.value) || 95 })}
          />
        </div>
      </FormFieldset>
    </div>
  );
}
