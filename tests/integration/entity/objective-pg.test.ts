import { afterEach, beforeEach, expect, it } from "bun:test";

import { checkInHabit, createHabit } from "@freeanima/features/habit/domain";
import {
  createObjective,
  deleteObjective,
  getObjective,
  linkObjective,
  listObjectives,
  updateObjective,
} from "@freeanima/features/objective/domain";
import { completeTaskItem, createTaskItem, createTaskList } from "@freeanima/features/task/domain";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";
import { testUserWorldId } from "../../helpers/world-context.ts";

describePg("objective module PG", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("freeanima-objective-");
  });

  afterEach(async () => {
    await endIntegrationCase();
    await restoreIntegrationHome(prev);
  });

  it("CRUD + manual metric + task auto progress + cascade delete", async () => {
    const worldId = testUserWorldId();

    const root = await createObjective(worldId, {
      title: "8 月跑量",
      content: "下个月跑满 100km",
      completion: { kind: "metric_manual", unit: "km", target: 100, current: 0 },
    });
    expect(root.status).toBe("not_started");
    expect(root.resolved_progress).toEqual({
      current: 0,
      target: 100,
      unit: "km",
      ratio: 0,
      source: "manual",
    });

    const child = await createObjective(worldId, {
      title: "子目标",
      parent_id: root.id,
      status: "in_progress",
    });
    expect(child.parent_id).toBe(root.id);

    const patched = await updateObjective(worldId, {
      id: root.id,
      status: "in_progress",
      completion: { kind: "metric_manual", unit: "km", target: 100, current: 32 },
    });
    expect(patched?.resolved_progress?.current).toBe(32);

    const list = await createTaskList(worldId, { name: "目标测" });
    const t1 = await createTaskItem(worldId, {
      title: "A",
      content: "",
      tag_ids: [],
      list_id: list.id,
    });
    const t2 = await createTaskItem(worldId, {
      title: "B",
      content: "",
      tag_ids: [],
      list_id: list.id,
    });
    const t3 = await createTaskItem(worldId, {
      title: "C",
      content: "",
      tag_ids: [],
      list_id: list.id,
    });

    const auto = await createObjective(worldId, {
      title: "三件事",
      completion: {
        kind: "metric_auto",
        unit: "个",
        target: 3,
        source: { type: "tasks_completed", task_ids: [t1.id, t2.id, t3.id] },
      },
    });
    expect(auto.resolved_progress?.current).toBe(0);

    await completeTaskItem(worldId, t1.id);
    await completeTaskItem(worldId, t2.id);
    const autoAgain = await getObjective(worldId, auto.id);
    expect(autoAgain?.resolved_progress?.current).toBe(2);
    expect(autoAgain?.resolved_progress?.source).toBe("tasks_completed");

    const linked = await linkObjective(worldId, auto.id, { kind: "task_item", id: t1.id });
    expect(linked?.links).toContainEqual({ kind: "task_item", id: t1.id });

    const habit = await createHabit(worldId, {
      title: "喝水",
      polarity: "build",
      record_mode: "auto",
      target: 1,
      unit: "杯",
      auto_amount: 1,
    });
    const habitObj = await createObjective(worldId, {
      title: "习惯",
      completion: {
        kind: "metric_auto",
        unit: "天",
        target: 1,
        source: { type: "habit", habit_id: habit.id },
      },
    });
    expect(habitObj.resolved_progress?.current).toBe(0);
    expect(habitObj.resolved_progress?.source).toBe("habit");

    await checkInHabit(worldId, { habit_id: habit.id });
    const habitAgain = await getObjective(worldId, habitObj.id);
    expect(habitAgain?.resolved_progress?.current).toBe(1);
    expect(habitAgain?.resolved_progress?.ratio).toBe(1);

    const ok = await deleteObjective(worldId, root.id);
    expect(ok).toBe(true);
    expect(await getObjective(worldId, root.id)).toBeNull();
    expect(await getObjective(worldId, child.id)).toBeNull();

    const remaining = await listObjectives(worldId, { include_inactive: true });
    expect(remaining.some((o) => o.id === auto.id)).toBe(true);
  });
});
