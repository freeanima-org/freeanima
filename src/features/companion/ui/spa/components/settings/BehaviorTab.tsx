import { Card, CardContent, Input } from "@freeanima/ui-kit";
import { FormFieldLabel, FormFieldset, FormToggle } from "@freeanima/ui-kit/form/FormFieldset.tsx";
import {
  AUTO_PERSIST_SHORT,
  createAutoPersistScheduler,
} from "@freeanima/ui-kit/lib/auto-persist-schedule.ts";
import { useCompanionStore } from "@freeanima/features/companion/ui/spa/stores/companion.ts";
import type { CompanionBehavior } from "@freeanima/features/companion/shared/companion-schema.ts";
import { useEffect, useMemo, useRef, useState } from "react";

type NumberFields = Pick<
  CompanionBehavior,
  "idle_patrol_delay_sec" | "patrol_pause_sec" | "patrol_speed_px"
>;

function numbersFromBehavior(behavior: CompanionBehavior): NumberFields {
  return {
    idle_patrol_delay_sec: behavior.idle_patrol_delay_sec,
    patrol_pause_sec: behavior.patrol_pause_sec,
    patrol_speed_px: behavior.patrol_speed_px,
  };
}

export function BehaviorTab() {
  const behavior = useCompanionStore((s) => s.behavior);
  const updateSettings = useCompanionStore((s) => s.updateSettings);

  const [numbers, setNumbers] = useState<NumberFields>(() => numbersFromBehavior(behavior));
  const numbersRef = useRef(numbers);
  numbersRef.current = numbers;
  const behaviorRef = useRef(behavior);
  behaviorRef.current = behavior;

  const numberPersistScheduler = useMemo(
    () =>
      createAutoPersistScheduler({
        ...AUTO_PERSIST_SHORT,
        onFire: () => {
          const n = numbersRef.current;
          void updateSettings({ behavior: { ...behaviorRef.current, ...n } });
        },
      }),
    [updateSettings],
  );

  useEffect(() => () => numberPersistScheduler.flush(), [numberPersistScheduler]);

  useEffect(() => {
    if (numberPersistScheduler.isPending()) return;
    setNumbers(numbersFromBehavior(behavior));
  }, [behavior, numberPersistScheduler]);

  const patchToggle = (p: Partial<CompanionBehavior>): void => {
    void updateSettings({ behavior: { ...behavior, ...p } });
  };

  const patchNumber = <K extends keyof NumberFields>(key: K, value: NumberFields[K]) => {
    const next = { ...numbersRef.current, [key]: value };
    numbersRef.current = next;
    setNumbers(next);
    numberPersistScheduler.schedule();
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-0 border bg-muted/30 py-0 shadow-none">
        <CardContent className="flex flex-col gap-2 px-4 py-4">
          <FormFieldset bordered={false} className="gap-1">
            <FormToggle
              label="空闲自动巡逻"
              checked={behavior.patrol_enabled}
              onChange={(checked) => patchToggle({ patrol_enabled: checked })}
            />
            <FormToggle
              label="双击角色进入巡逻"
              checked={behavior.double_click_patrol}
              onChange={(checked) => patchToggle({ double_click_patrol: checked })}
            />
            <FormToggle
              label="启动时从屏幕中心走到左上角"
              checked={behavior.startup_walk_enabled}
              onChange={(checked) => patchToggle({ startup_walk_enabled: checked })}
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
            value={numbers.idle_patrol_delay_sec}
            onChange={(e) => patchNumber("idle_patrol_delay_sec", Number(e.target.value) || 180)}
          />
        </div>
        <div>
          <FormFieldLabel htmlFor="patrol-pause">角点停顿（秒）</FormFieldLabel>
          <Input
            id="patrol-pause"
            type="number"
            min={0}
            className="h-8"
            value={numbers.patrol_pause_sec}
            onChange={(e) => patchNumber("patrol_pause_sec", Number(e.target.value) || 10)}
          />
        </div>
        <div className="sm:col-span-2">
          <FormFieldLabel htmlFor="patrol-speed">巡逻速度（px/s）</FormFieldLabel>
          <Input
            id="patrol-speed"
            type="number"
            min={20}
            className="h-8"
            value={numbers.patrol_speed_px}
            onChange={(e) => patchNumber("patrol_speed_px", Number(e.target.value) || 95)}
          />
        </div>
      </FormFieldset>
    </div>
  );
}
