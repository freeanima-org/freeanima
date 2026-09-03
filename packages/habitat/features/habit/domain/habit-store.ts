import {
  HABIT_CHECK_IN_COMPONENT,
  HABIT_COMPONENT,
  asHabit,
  asHabitCheckIn,
  habitBodySchema,
  type HabitBody,
} from "@freeanima/habitat/core/db/schema/entity";
import { assertEntityInWorld } from "@freeanima/habitat/core/db/pg/entity";
import { omitUndefined } from "@freeanima/habitat/core/util";
import {
  createEntity,
  deleteEntity,
  getEntity,
  listEntities,
  searchEntities,
  updateEntity,
} from "@freeanima/habitat/core/db/pg/entity";
import { formatCstIso, hostCalendarDay } from "@freeanima/shared/util/time.ts";

import { listDaysInMonth, todayHostDay, eachDayInclusive, isHabitDueOnDay } from "./frequency.ts";
import { booleanCheckInAmount, defaultBooleanTarget, isHabitDayMet } from "./habit-met.ts";
import type {
  HabitCheckInInput,
  HabitCheckInRow,
  HabitCreateInput,
  HabitDayCell,
  HabitListOpts,
  HabitRow,
  HabitStats,
  HabitUpdateInput,
} from "./types.ts";

function toHabitRow(
  row: NonNullable<ReturnType<typeof asHabit>>,
  extras?: Partial<Pick<HabitRow, "today_amount" | "today_met" | "today_check_in_id">>,
): HabitRow {
  return omitUndefined({
    id: row.id,
    title: row.title,
    content: row.content,
    polarity: row.polarity,
    record_mode: row.record_mode,
    target: row.target,
    unit: row.unit ?? null,
    auto_amount: row.auto_amount ?? null,
    frequency: row.frequency,
    day_section: row.day_section,
    reminders: row.reminders ?? [],
    enable_journal: row.enable_journal,
    check_in_style: row.check_in_style,
    status: row.status,
    sort_order: row.sort_order ?? 0,
    color: row.color ?? null,
    icon: row.icon ?? null,
    today_amount: extras?.today_amount,
    today_met: extras?.today_met,
    today_check_in_id: extras?.today_check_in_id,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  });
}

function toCheckInRow(row: NonNullable<ReturnType<typeof asHabitCheckIn>>): HabitCheckInRow {
  return {
    id: row.id,
    habit_id: row.habit_id,
    day: row.day,
    amount: row.amount,
    mood: row.mood ?? null,
    note: row.note ?? null,
    checked_at: row.checked_at,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

function buildHabitBody(input: {
  polarity: HabitBody["polarity"];
  record_mode: HabitBody["record_mode"];
  target: number;
  unit: string | null;
  auto_amount: number | null;
  frequency: HabitBody["frequency"];
  day_section: HabitBody["day_section"];
  reminders: HabitBody["reminders"];
  enable_journal: boolean;
  check_in_style: HabitBody["check_in_style"];
  status: HabitBody["status"];
  sort_order: number;
  color?: string | null;
  icon?: string | null;
}): HabitBody {
  const raw = {
    polarity: input.polarity,
    record_mode: input.record_mode,
    target: input.record_mode === "boolean" ? defaultBooleanTarget(input.polarity) : input.target,
    unit: input.unit,
    auto_amount: input.record_mode === "auto" ? input.auto_amount : null,
    frequency: input.frequency,
    day_section: input.day_section,
    reminders: input.reminders,
    enable_journal: input.enable_journal,
    check_in_style: input.check_in_style,
    status: input.status,
    sort_order: input.sort_order,
    ...(input.color !== undefined ? { color: input.color } : {}),
    ...(input.icon !== undefined ? { icon: input.icon } : {}),
  };
  return habitBodySchema.parse(raw);
}

async function findByClientOpId(worldId: number, clientOpId: string): Promise<HabitRow | null> {
  const result = await searchEntities({
    world_id: worldId,
    primary_component: HABIT_COMPONENT,
    filters: { client_op_id: clientOpId },
    limit: 1,
    mode: "filter_only",
    include_count: false,
  });
  const row = result.results[0];
  if (!row) return null;
  const parsed = asHabit(row);
  return parsed ? toHabitRow(parsed) : null;
}

async function listCheckInEntities(worldId: number, habitId?: number): Promise<HabitCheckInRow[]> {
  const rows = await listEntities({
    world_id: worldId,
    primary_component: HABIT_CHECK_IN_COMPONENT,
    limit: 5000,
  });
  const out: HabitCheckInRow[] = [];
  for (const row of rows) {
    const parsed = asHabitCheckIn(row);
    if (!parsed) continue;
    if (habitId != null && parsed.habit_id !== habitId) continue;
    out.push(toCheckInRow(parsed));
  }
  return out;
}

async function findCheckInForDay(
  worldId: number,
  habitId: number,
  day: string,
): Promise<HabitCheckInRow | null> {
  const items = await listCheckInEntities(worldId, habitId);
  return items.find((c) => c.day === day) ?? null;
}

async function withToday(worldId: number, habit: HabitRow): Promise<HabitRow> {
  const day = todayHostDay();
  const checkIn = await findCheckInForDay(worldId, habit.id, day);
  const amount = checkIn?.amount ?? 0;
  return {
    ...habit,
    today_amount: amount,
    today_met: isHabitDayMet(habit.polarity, amount, habit.target),
    today_check_in_id: checkIn?.id ?? null,
  };
}

export async function listHabits(worldId: number, opts: HabitListOpts = {}): Promise<HabitRow[]> {
  const status = opts.status ?? "active";
  const rows = await listEntities({
    world_id: worldId,
    primary_component: HABIT_COMPONENT,
    limit: 1000,
  });
  const out: HabitRow[] = [];
  for (const row of rows) {
    const parsed = asHabit(row);
    if (!parsed) continue;
    if (parsed.status !== status) continue;
    let habit = toHabitRow(parsed);
    if (opts.include_today) habit = await withToday(worldId, habit);
    out.push(habit);
  }
  return out.toSorted(
    (a, b) =>
      a.day_section.localeCompare(b.day_section) || a.sort_order - b.sort_order || a.id - b.id,
  );
}

export async function getHabit(
  worldId: number,
  id: number,
  opts?: { include_today?: boolean },
): Promise<HabitRow | null> {
  const row = await getEntity(id);
  if (!row || row.primary_component !== HABIT_COMPONENT) return null;
  if (row.world_id !== worldId) return null;
  const parsed = asHabit(row);
  if (!parsed) return null;
  let habit = toHabitRow(parsed);
  if (opts?.include_today) habit = await withToday(worldId, habit);
  return habit;
}

export async function createHabit(worldId: number, input: HabitCreateInput): Promise<HabitRow> {
  if (input.client_op_id) {
    const existing = await findByClientOpId(worldId, input.client_op_id);
    if (existing) return existing;
  }

  const record_mode = input.record_mode ?? "boolean";
  const body = buildHabitBody({
    polarity: input.polarity ?? "build",
    record_mode,
    target: input.target ?? 1,
    unit: input.unit ?? null,
    auto_amount: input.auto_amount ?? (record_mode === "auto" ? 1 : null),
    frequency: input.frequency ?? { freq: "daily", interval: 1 },
    day_section: input.day_section ?? "other",
    reminders: input.reminders ?? [],
    enable_journal: input.enable_journal ?? true,
    check_in_style: input.check_in_style ?? "check",
    status: "active",
    sort_order: input.sort_order ?? 0,
    color: input.color ?? null,
    icon: input.icon ?? null,
  });

  // 缺省 anchor_day = 今天
  if (!body.frequency.anchor_day) {
    body.frequency = { ...body.frequency, anchor_day: hostCalendarDay() };
  }

  const row = await createEntity({
    type: "content",
    world_id: worldId,
    components: [HABIT_COMPONENT],
    primary_component: HABIT_COMPONENT,
    title: input.title.trim(),
    summary: "",
    content: input.content?.trim() ?? "",
    body,
    client_op_id: input.client_op_id ?? null,
  });
  const parsed = asHabit(row);
  if (!parsed) throw new Error("habit create parse failed");
  return toHabitRow(parsed);
}

export async function updateHabit(
  worldId: number,
  input: HabitUpdateInput,
): Promise<HabitRow | null> {
  const existing = await getEntity(input.id);
  if (!existing || existing.primary_component !== HABIT_COMPONENT) return null;
  if (existing.world_id !== worldId) return null;
  const current = asHabit(existing);
  if (!current) return null;

  const record_mode = input.record_mode ?? current.record_mode;
  const body = buildHabitBody({
    polarity: input.polarity ?? current.polarity,
    record_mode,
    target: input.target ?? current.target,
    unit: input.unit !== undefined ? input.unit : (current.unit ?? null),
    auto_amount:
      input.auto_amount !== undefined ? input.auto_amount : (current.auto_amount ?? null),
    frequency: input.frequency ?? current.frequency,
    day_section: input.day_section ?? current.day_section,
    reminders: input.reminders ?? current.reminders ?? [],
    enable_journal: input.enable_journal ?? current.enable_journal,
    check_in_style: input.check_in_style ?? current.check_in_style,
    status: input.status ?? current.status,
    sort_order: input.sort_order !== undefined ? input.sort_order : (current.sort_order ?? 0),
    color: input.color !== undefined ? input.color : (current.color ?? null),
    icon: input.icon !== undefined ? input.icon : (current.icon ?? null),
  });

  const updated = await updateEntity(
    omitUndefined({
      id: input.id,
      title: input.title !== undefined ? input.title.trim() : undefined,
      content: input.content !== undefined ? input.content : undefined,
      body,
    }),
  );
  if (!updated) return null;
  const parsed = asHabit(updated);
  return parsed ? toHabitRow(parsed) : null;
}

export async function deleteHabit(worldId: number, id: number): Promise<boolean> {
  const existing = await getEntity(id);
  if (!existing || existing.primary_component !== HABIT_COMPONENT) return false;
  if (existing.world_id !== worldId) return false;
  await assertEntityInWorld(id, worldId);
  const checkIns = await listCheckInEntities(worldId, id);
  for (const c of checkIns) {
    await deleteEntity(c.id);
  }
  await deleteEntity(id);
  return true;
}

export async function reorderHabits(worldId: number, orderedIds: number[]): Promise<boolean> {
  let order = 0;
  for (const id of orderedIds) {
    const habit = await getHabit(worldId, id);
    if (!habit) continue;
    await updateHabit(worldId, { id, sort_order: order });
    order += 1;
  }
  return true;
}

export async function archiveHabit(worldId: number, id: number): Promise<HabitRow | null> {
  return updateHabit(worldId, { id, status: "archived" });
}

export async function unarchiveHabit(worldId: number, id: number): Promise<HabitRow | null> {
  return updateHabit(worldId, { id, status: "active" });
}

export async function listHabitCheckIns(
  worldId: number,
  habitId: number,
  from: string,
  to: string,
): Promise<HabitCheckInRow[]> {
  const habit = await getHabit(worldId, habitId);
  if (!habit) return [];
  const items = await listCheckInEntities(worldId, habitId);
  return items
    .filter((c) => c.day >= from && c.day <= to)
    .toSorted((a, b) => a.day.localeCompare(b.day));
}

export async function checkInHabit(
  worldId: number,
  input: HabitCheckInInput,
): Promise<{ check_in: HabitCheckInRow; habit: HabitRow }> {
  const habit = await getHabit(worldId, input.habit_id, { include_today: true });
  if (!habit) throw new Error("NOT_FOUND");
  if (habit.status !== "active") throw new Error("习惯已归档");

  const day = input.day ?? todayHostDay();
  const existing = await findCheckInForDay(worldId, habit.id, day);
  let nextAmount = existing?.amount ?? 0;

  if (input.amount != null) {
    nextAmount = input.amount;
  } else if (habit.record_mode === "boolean") {
    nextAmount = booleanCheckInAmount(habit.polarity, habit.target);
  } else if (habit.record_mode === "auto") {
    const delta = habit.auto_amount ?? 1;
    nextAmount += delta;
  } else {
    // manual
    if (input.amount_delta == null || input.amount_delta <= 0) {
      throw new Error("manual 打卡须提供 amount_delta");
    }
    nextAmount += input.amount_delta;
  }

  const checked_at = formatCstIso();
  const mood = input.mood !== undefined ? input.mood : (existing?.mood ?? null);
  const note = input.note !== undefined ? input.note : (existing?.note ?? null);

  let checkIn: HabitCheckInRow;
  if (existing) {
    const updated = await updateEntity({
      id: existing.id,
      body: {
        habit_id: habit.id,
        day,
        amount: nextAmount,
        mood,
        note,
        checked_at,
      },
    });
    if (!updated) throw new Error("check-in update failed");
    const parsed = asHabitCheckIn(updated);
    if (!parsed) throw new Error("check-in parse failed");
    checkIn = toCheckInRow(parsed);
  } else {
    const created = await createEntity({
      type: "content",
      world_id: worldId,
      components: [HABIT_CHECK_IN_COMPONENT],
      primary_component: HABIT_CHECK_IN_COMPONENT,
      title: `${habit.title} · ${day}`,
      summary: "",
      content: "",
      body: {
        habit_id: habit.id,
        day,
        amount: nextAmount,
        mood,
        note,
        checked_at,
      },
    });
    const parsed = asHabitCheckIn(created);
    if (!parsed) throw new Error("check-in create failed");
    checkIn = toCheckInRow(parsed);
  }

  const refreshed = await getHabit(worldId, habit.id, { include_today: true });
  if (!refreshed) throw new Error("NOT_FOUND");
  return { check_in: checkIn, habit: refreshed };
}

export async function undoCheckInHabit(
  worldId: number,
  input: {
    habit_id: number;
    day?: string;
    amount_delta?: number;
  },
): Promise<{ check_in: HabitCheckInRow | null; habit: HabitRow }> {
  const habit = await getHabit(worldId, input.habit_id, { include_today: true });
  if (!habit) throw new Error("NOT_FOUND");
  const day = input.day ?? todayHostDay();
  const existing = await findCheckInForDay(worldId, habit.id, day);
  if (!existing) {
    return { check_in: null, habit };
  }

  if (input.amount_delta == null) {
    await deleteEntity(existing.id);
    const refreshed = await getHabit(worldId, habit.id, { include_today: true });
    if (!refreshed) throw new Error("NOT_FOUND");
    return { check_in: null, habit: refreshed };
  }

  const nextAmount = Math.max(0, existing.amount - input.amount_delta);
  if (nextAmount <= 0) {
    await deleteEntity(existing.id);
    const refreshed = await getHabit(worldId, habit.id, { include_today: true });
    if (!refreshed) throw new Error("NOT_FOUND");
    return { check_in: null, habit: refreshed };
  }

  const updated = await updateEntity({
    id: existing.id,
    body: {
      habit_id: habit.id,
      day,
      amount: nextAmount,
      mood: existing.mood,
      note: existing.note,
      checked_at: formatCstIso(),
    },
  });
  if (!updated) throw new Error("undo failed");
  const parsed = asHabitCheckIn(updated);
  if (!parsed) throw new Error("undo parse failed");
  const refreshed = await getHabit(worldId, habit.id, { include_today: true });
  if (!refreshed) throw new Error("NOT_FOUND");
  return { check_in: toCheckInRow(parsed), habit: refreshed };
}

function computeStreaks(
  metDays: Set<string>,
  dueDaysSortedAsc: string[],
): { current: number; best: number } {
  let best = 0;
  let run = 0;
  for (const day of dueDaysSortedAsc) {
    if (metDays.has(day)) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  // current streak: from today backwards over due days
  let current = 0;
  for (let i = dueDaysSortedAsc.length - 1; i >= 0; i -= 1) {
    const day = dueDaysSortedAsc[i];
    if (day == null) continue;
    if (metDays.has(day)) current += 1;
    else break;
  }
  return { current, best };
}

export async function getHabitStats(
  worldId: number,
  habitId: number,
  month?: string,
): Promise<HabitStats | null> {
  const habit = await getHabit(worldId, habitId);
  if (!habit) return null;
  const checkIns = await listCheckInEntities(worldId, habitId);
  const amountByDay = new Map(checkIns.map((c) => [c.day, c] as const));

  const today = todayHostDay();
  const monthKey = month ?? today.slice(0, 7);
  const monthDays = listDaysInMonth(monthKey);
  const month_cells: HabitDayCell[] = monthDays.map((day) => {
    const c = amountByDay.get(day);
    const amount = c?.amount ?? 0;
    return {
      day,
      amount,
      met: isHabitDayMet(habit.polarity, amount, habit.target),
      check_in_id: c?.id ?? null,
    };
  });

  const allDays = checkIns.map((c) => c.day).toSorted();
  const from = allDays[0] ?? habit.created_at.slice(0, 10);
  const createdDay = habit.created_at.slice(0, 10);
  const dueDays = eachDayInclusive(from, today).filter((d) =>
    isHabitDueOnDay(habit.frequency, d, createdDay),
  );
  const metDays = new Set(
    dueDays.filter((day) => {
      const amount = amountByDay.get(day)?.amount ?? 0;
      return isHabitDayMet(habit.polarity, amount, habit.target);
    }),
  );
  const { current, best } = computeStreaks(metDays, dueDays);

  return {
    habit_id: habitId,
    total_met_days: metDays.size,
    current_streak: current,
    best_streak: best,
    month_met_days: month_cells.filter((c) => c.met).length,
    month_cells,
  };
}

/** 目标进度：窗内达标日数（按应打卡日 + 极性谓词；戒除无记录也计达标） */
export async function countHabitMetDaysInWindow(
  worldId: number,
  habitId: number,
  startAt: string | null,
  endAt: string | null,
): Promise<number> {
  const habit = await getHabit(worldId, habitId);
  if (!habit) return 0;
  const checkIns = await listCheckInEntities(worldId, habitId);
  const amountByDay = new Map(checkIns.map((c) => [c.day, c.amount] as const));
  const createdDay = habit.created_at.slice(0, 10);
  const today = todayHostDay();
  const windowStart = startAt ? startAt.slice(0, 10) : createdDay;
  const windowEnd = endAt ? endAt.slice(0, 10) : today;
  const from = windowStart < createdDay ? createdDay : windowStart;
  const to = windowEnd > today ? today : windowEnd;
  if (from > to) return 0;

  let count = 0;
  for (const day of eachDayInclusive(from, to)) {
    if (!isHabitDueOnDay(habit.frequency, day, createdDay)) continue;
    const amount = amountByDay.get(day) ?? 0;
    if (isHabitDayMet(habit.polarity, amount, habit.target)) count += 1;
  }
  return count;
}
