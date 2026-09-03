import { resolvePrivateWorldId } from "@freeanima/habitat/core/config/world-context-pg";
import { isPostgresPrimary } from "@freeanima/habitat/core/db/pg";
import { omitUndefined } from "@freeanima/habitat/core/util";
import type { VerifiedServiceApiToken } from "@freeanima/habitat/core/db/pg/service-api-token";
import type { RpcRequestAuthContext } from "@freeanima/shared/rpc-contract";
import type {
  HabitCheckInStyle,
  HabitDaySection,
  HabitFrequency,
  HabitMood,
  HabitPolarity,
  HabitRecordMode,
  HabitReminder,
  HabitStatus,
} from "@freeanima/habitat/core/db/schema/entity";

import {
  archiveHabit,
  checkInHabit,
  createHabit,
  deleteHabit,
  getHabit,
  getHabitStats,
  listHabitCheckIns,
  listHabitPresets,
  listHabits,
  reorderHabits,
  unarchiveHabit,
  undoCheckInHabit,
  updateHabit,
} from "../domain/index.ts";
import type { RuntimeDeps } from "./runtime-deps.ts";

function assertPg(_deps: RuntimeDeps): void {
  if (!isPostgresPrimary()) {
    throw new Error("PostgreSQL unavailable");
  }
}

function assertSubjectIdAllowed(auth: RpcRequestAuthContext, subjectId: number): void {
  if (auth.subject_id === subjectId) return;
  if (auth.subject_type === "user") return;
  throw new Error("FORBIDDEN_SUBJECT");
}

function requireSubjectId(subject_id: number | undefined): number {
  if (subject_id == null || !Number.isInteger(subject_id) || subject_id <= 0) {
    throw new Error("subject_id is required");
  }
  return subject_id;
}

async function habitWorldIdForAuth(
  auth: RpcRequestAuthContext,
  subject_id: number | undefined,
): Promise<number> {
  const subjectId = requireSubjectId(subject_id);
  assertSubjectIdAllowed(auth, subjectId);
  return resolvePrivateWorldId(subjectId);
}

export async function serviceHabitList(
  deps: RuntimeDeps,
  input: { subject_id: number; status?: HabitStatus; include_today?: boolean },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await habitWorldIdForAuth(auth, input.subject_id);
  const items = await listHabits(
    worldId,
    omitUndefined({ status: input.status, include_today: input.include_today }),
  );
  return { items };
}

export async function serviceHabitGet(
  deps: RuntimeDeps,
  input: { subject_id: number; id: number; include_today?: boolean },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await habitWorldIdForAuth(auth, input.subject_id);
  const item = await getHabit(
    worldId,
    input.id,
    omitUndefined({ include_today: input.include_today }),
  );
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceHabitCreate(
  deps: RuntimeDeps,
  input: {
    subject_id: number;
    title: string;
    content?: string;
    polarity?: HabitPolarity;
    record_mode?: HabitRecordMode;
    target?: number;
    unit?: string | null;
    auto_amount?: number | null;
    frequency?: HabitFrequency;
    day_section?: HabitDaySection;
    reminders?: HabitReminder[];
    enable_journal?: boolean;
    check_in_style?: HabitCheckInStyle;
    sort_order?: number;
    color?: string | null;
    icon?: string | null;
    client_op_id?: string;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await habitWorldIdForAuth(auth, input.subject_id);
  const { subject_id: _sid, ...rest } = input;
  const item = await createHabit(worldId, omitUndefined(rest));
  return { item };
}

export async function serviceHabitPatch(
  deps: RuntimeDeps,
  input: {
    subject_id: number;
    id: number;
    title?: string;
    content?: string;
    polarity?: HabitPolarity;
    record_mode?: HabitRecordMode;
    target?: number;
    unit?: string | null;
    auto_amount?: number | null;
    frequency?: HabitFrequency;
    day_section?: HabitDaySection;
    reminders?: HabitReminder[];
    enable_journal?: boolean;
    check_in_style?: HabitCheckInStyle;
    sort_order?: number;
    color?: string | null;
    icon?: string | null;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await habitWorldIdForAuth(auth, input.subject_id);
  const { subject_id: _sid, ...rest } = input;
  const item = await updateHabit(worldId, omitUndefined(rest));
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceHabitDelete(
  deps: RuntimeDeps,
  input: { subject_id: number; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await habitWorldIdForAuth(auth, input.subject_id);
  const ok = await deleteHabit(worldId, input.id);
  if (!ok) throw new Error("NOT_FOUND");
  return { ok: true as const };
}

export async function serviceHabitReorder(
  deps: RuntimeDeps,
  input: { subject_id: number; ordered_ids: number[] },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await habitWorldIdForAuth(auth, input.subject_id);
  await reorderHabits(worldId, input.ordered_ids);
  return { ok: true as const };
}

export async function serviceHabitArchive(
  deps: RuntimeDeps,
  input: { subject_id: number; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await habitWorldIdForAuth(auth, input.subject_id);
  const item = await archiveHabit(worldId, input.id);
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceHabitUnarchive(
  deps: RuntimeDeps,
  input: { subject_id: number; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await habitWorldIdForAuth(auth, input.subject_id);
  const item = await unarchiveHabit(worldId, input.id);
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceHabitCheckIn(
  deps: RuntimeDeps,
  input: {
    subject_id: number;
    habit_id: number;
    day?: string;
    amount_delta?: number;
    amount?: number;
    mood?: HabitMood | null;
    note?: string | null;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await habitWorldIdForAuth(auth, input.subject_id);
  const { subject_id: _sid, ...rest } = input;
  return checkInHabit(worldId, omitUndefined(rest));
}

export async function serviceHabitUndoCheckIn(
  deps: RuntimeDeps,
  input: {
    subject_id: number;
    habit_id: number;
    day?: string;
    amount_delta?: number;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await habitWorldIdForAuth(auth, input.subject_id);
  const { subject_id: _sid, ...rest } = input;
  return undoCheckInHabit(worldId, omitUndefined(rest));
}

export async function serviceHabitListCheckIns(
  deps: RuntimeDeps,
  input: { subject_id: number; habit_id: number; from: string; to: string },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await habitWorldIdForAuth(auth, input.subject_id);
  const items = await listHabitCheckIns(worldId, input.habit_id, input.from, input.to);
  return { items };
}

export async function serviceHabitStats(
  deps: RuntimeDeps,
  input: { subject_id: number; habit_id: number; month?: string },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await habitWorldIdForAuth(auth, input.subject_id);
  const stats = await getHabitStats(worldId, input.habit_id, input.month);
  if (!stats) throw new Error("NOT_FOUND");
  return { stats };
}

export async function serviceHabitPresets(
  deps: RuntimeDeps,
  input: { subject_id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  await habitWorldIdForAuth(auth, input.subject_id);
  return { items: listHabitPresets() };
}
