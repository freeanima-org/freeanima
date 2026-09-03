import type {
  HabitCheckInRowPayload,
  HabitPresetPayload,
  HabitRowPayload,
  HabitStatsPayload,
} from "@freeanima/shared/rpc-contract/frames/habit.ts";
import { resolveHabitatCacheScope } from "@freeanima/client/portal-sdk/offline-cache";
import { withOfflineCache } from "@freeanima/client/portal-sdk/offline-cache-first";
import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";
import { invalidatePortalReads } from "@freeanima/client/portal-sdk/portal-query";
import { omitUndefined } from "@freeanima/shared/util";

export type HabitRow = HabitRowPayload;
export type HabitCheckInRow = HabitCheckInRowPayload;
export type HabitStats = HabitStatsPayload;
export type HabitPreset = HabitPresetPayload;

function habitat() {
  return getTypedHabitatClient();
}

export const DAY_SECTION_LABEL: Record<HabitRow["day_section"], string> = {
  morning: "上午",
  afternoon: "下午",
  evening: "晚上",
  other: "其他",
};

export const POLARITY_LABEL: Record<HabitRow["polarity"], string> = {
  build: "养成",
  break: "戒除",
};

export const RECORD_MODE_LABEL: Record<HabitRow["record_mode"], string> = {
  boolean: "完成全部",
  auto: "自动记录",
  manual: "手动记录",
};

export async function fetchHabits(
  subjectId: number,
  opts?: { status?: HabitRow["status"]; include_today?: boolean },
): Promise<HabitRow[]> {
  const scope = resolveHabitatCacheScope();
  const status = opts?.status ?? "active";
  return withOfflineCache({
    scope,
    namespace: "habit",
    id: `list:${subjectId}:${status}`,
    fetch: async () => {
      const data = await habitat().call(
        "habit.list",
        omitUndefined({
          subject_id: subjectId,
          status,
          include_today: opts?.include_today ?? true,
        }),
      );
      return data.items;
    },
    offlineError: "habit.list unavailable offline",
  });
}

export async function createHabitRemote(
  subjectId: number,
  input: {
    title: string;
    content?: string;
    polarity?: HabitRow["polarity"];
    record_mode?: HabitRow["record_mode"];
    target?: number;
    unit?: string | null;
    auto_amount?: number | null;
    day_section?: HabitRow["day_section"];
    reminders?: HabitRow["reminders"];
    enable_journal?: boolean;
    check_in_style?: HabitRow["check_in_style"];
    icon?: string | null;
  },
): Promise<HabitRow> {
  const data = await habitat().call(
    "habit.create",
    omitUndefined({ subject_id: subjectId, ...input }),
  );
  await invalidatePortalReads(["habit"]);
  return data.item;
}

export async function patchHabitRemote(
  subjectId: number,
  id: number,
  patch: Partial<{
    title: string;
    content: string;
    polarity: HabitRow["polarity"];
    record_mode: HabitRow["record_mode"];
    target: number;
    unit: string | null;
    auto_amount: number | null;
    day_section: HabitRow["day_section"];
    reminders: HabitRow["reminders"];
    enable_journal: boolean;
    check_in_style: HabitRow["check_in_style"];
    sort_order: number;
    icon: string | null;
  }>,
): Promise<HabitRow> {
  const data = await habitat().call(
    "habit.patch",
    omitUndefined({ subject_id: subjectId, id, ...patch }),
  );
  await invalidatePortalReads(["habit"]);
  return data.item;
}

export async function deleteHabitRemote(subjectId: number, id: number): Promise<void> {
  await habitat().call("habit.delete", { subject_id: subjectId, id });
  await invalidatePortalReads(["habit"]);
}

export async function archiveHabitRemote(subjectId: number, id: number): Promise<HabitRow> {
  const data = await habitat().call("habit.archive", { subject_id: subjectId, id });
  await invalidatePortalReads(["habit"]);
  return data.item;
}

export async function unarchiveHabitRemote(subjectId: number, id: number): Promise<HabitRow> {
  const data = await habitat().call("habit.unarchive", { subject_id: subjectId, id });
  await invalidatePortalReads(["habit"]);
  return data.item;
}

export async function reorderHabitsRemote(subjectId: number, orderedIds: number[]): Promise<void> {
  await habitat().call("habit.reorder", { subject_id: subjectId, ordered_ids: orderedIds });
  await invalidatePortalReads(["habit"]);
}

export async function checkInHabitRemote(
  subjectId: number,
  input: {
    habit_id: number;
    day?: string;
    amount_delta?: number;
    amount?: number;
    mood?: HabitCheckInRow["mood"];
    note?: string | null;
  },
): Promise<{ check_in: HabitCheckInRow; habit: HabitRow }> {
  const data = await habitat().call(
    "habit.checkIn",
    omitUndefined({ subject_id: subjectId, ...input }),
  );
  await invalidatePortalReads(["habit", "calendar"]);
  return data;
}

export async function undoCheckInRemote(
  subjectId: number,
  input: { habit_id: number; day?: string; amount_delta?: number },
): Promise<{ check_in: HabitCheckInRow | null; habit: HabitRow }> {
  const data = await habitat().call(
    "habit.undoCheckIn",
    omitUndefined({ subject_id: subjectId, ...input }),
  );
  await invalidatePortalReads(["habit", "calendar"]);
  return data;
}

export async function fetchHabitStats(
  subjectId: number,
  habitId: number,
  month?: string,
): Promise<HabitStats> {
  const data = await habitat().call(
    "habit.stats",
    omitUndefined({ subject_id: subjectId, habit_id: habitId, month }),
  );
  return data.stats;
}

export async function fetchHabitPresets(subjectId: number): Promise<HabitPreset[]> {
  const data = await habitat().call("habit.presets", { subject_id: subjectId });
  return data.items;
}
