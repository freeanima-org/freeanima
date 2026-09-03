import { afterEach, beforeEach, expect, it } from "bun:test";

import {
  checkInHabit,
  createHabit,
  deleteHabit,
  getHabit,
  getHabitStats,
  listHabits,
} from "@freeanima/features/habit/domain";
import { listCalendarRange } from "@freeanima/features/calendar/domain/range-store.ts";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";
import { testUserWorldId } from "../../helpers/world-context.ts";

describePg("habit module PG", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("freeanima-habit-");
  });

  afterEach(async () => {
    await endIntegrationCase();
    await restoreIntegrationHome(prev);
  });

  it("CRUD + checkIn + stats + calendar.range habit", async () => {
    const worldId = testUserWorldId();

    const habit = await createHabit(worldId, {
      title: "喝水",
      polarity: "build",
      record_mode: "auto",
      target: 3,
      unit: "杯",
      auto_amount: 1,
      day_section: "morning",
      reminders: [{ time: "09:00" }],
    });
    expect(habit.status).toBe("active");
    expect(habit.target).toBe(3);

    const listed = await listHabits(worldId, { include_today: true });
    expect(listed.some((h) => h.id === habit.id)).toBe(true);

    await checkInHabit(worldId, { habit_id: habit.id });
    await checkInHabit(worldId, { habit_id: habit.id });
    const afterTwo = await getHabit(worldId, habit.id, { include_today: true });
    expect(afterTwo?.today_amount).toBe(2);
    expect(afterTwo?.today_met).toBe(false);

    await checkInHabit(worldId, { habit_id: habit.id });
    const met = await getHabit(worldId, habit.id, { include_today: true });
    expect(met?.today_met).toBe(true);

    const stats = await getHabitStats(worldId, habit.id);
    expect(stats?.total_met_days).toBeGreaterThanOrEqual(1);

    const { hostCalendarDay } = await import("@freeanima/shared/util/time.ts");
    const today = hostCalendarDay();
    const range = await listCalendarRange(
      { worldId },
      {
        from: `${today}T00:00:00.000Z`,
        to: `${today}T23:59:59.999Z`,
        kinds: ["habit"],
      },
    );
    expect(range.some((i) => i.kind === "habit" && i.id === habit.id)).toBe(true);

    const ok = await deleteHabit(worldId, habit.id);
    expect(ok).toBe(true);
    expect(await getHabit(worldId, habit.id)).toBeNull();
  });

  it("戒除日上限：无记录达标，记一次后超限", async () => {
    const worldId = testUserWorldId();
    const habit = await createHabit(worldId, {
      title: "戒零食",
      polarity: "break",
      record_mode: "boolean",
      day_section: "other",
    });
    expect(habit.target).toBe(0);

    const before = await getHabit(worldId, habit.id, { include_today: true });
    expect(before?.today_amount ?? 0).toBe(0);
    expect(before?.today_met).toBe(true);

    await checkInHabit(worldId, { habit_id: habit.id });
    const after = await getHabit(worldId, habit.id, { include_today: true });
    expect(after?.today_amount).toBe(1);
    expect(after?.today_met).toBe(false);

    const capped = await createHabit(worldId, {
      title: "少喝汽水",
      polarity: "break",
      record_mode: "auto",
      target: 2,
      unit: "罐",
      auto_amount: 1,
    });
    await checkInHabit(worldId, { habit_id: capped.id });
    await checkInHabit(worldId, { habit_id: capped.id });
    const atLimit = await getHabit(worldId, capped.id, { include_today: true });
    expect(atLimit?.today_amount).toBe(2);
    expect(atLimit?.today_met).toBe(true);
    await checkInHabit(worldId, { habit_id: capped.id });
    const over = await getHabit(worldId, capped.id, { include_today: true });
    expect(over?.today_amount).toBe(3);
    expect(over?.today_met).toBe(false);

    await deleteHabit(worldId, habit.id);
    await deleteHabit(worldId, capped.id);
  });
});
