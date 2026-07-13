import {
  enqueueOutboxOp,
  listOutboxOps,
  removeOutboxOp,
  resolveOutboxScope,
  type OfflineOutboxOp,
} from "@freeanima/frontend/shell-sdk/offline-outbox";

import type { PomodoroActiveStatePayload } from "@freeanima/shared/sap-contract/frames/pomodoro";
import { randomUuid } from "@freeanima/shared/sap-contract";

import type { PhaseEndPayload } from "./runtime.ts";
import type { PomodoroConfigRow, PomodoroSubjectKind } from "./api.ts";

const MODULE_ID = "pomodoro";

const COMPACT_METHODS = new Set([
  "pomodoro.config.update",
  "pomodoro.active.put",
  "pomodoro.active.clear",
]);

async function removeCompactPeers(scope: string, method: string): Promise<void> {
  const ops = await listOutboxOps(scope, MODULE_ID);
  for (const op of ops) {
    if (op.method === method) await removeOutboxOp(scope, op.id);
  }
}

async function enqueueOp(
  method: string,
  payload: Record<string, unknown>,
  opId?: string,
): Promise<void> {
  const scope = resolveOutboxScope();
  if (COMPACT_METHODS.has(method)) {
    await removeCompactPeers(scope, method);
  }
  const id = opId ?? randomUuid();
  const op: OfflineOutboxOp = {
    id,
    moduleId: MODULE_ID,
    method,
    payload,
    createdAt: new Date().toISOString(),
  };
  await enqueueOutboxOp(scope, op);
}

export async function enqueuePomodoroSessionComplete(
  subjectKind: PomodoroSubjectKind,
  payload: PhaseEndPayload,
): Promise<void> {
  await enqueueOp(
    "pomodoro.session.complete",
    { subject_kind: subjectKind, ...payload },
    payload.client_op_id,
  );
}

export async function enqueuePomodoroSessionAbort(
  subjectKind: PomodoroSubjectKind,
  payload: PhaseEndPayload,
): Promise<void> {
  await enqueueOp(
    "pomodoro.session.abort",
    { subject_kind: subjectKind, ...payload },
    payload.client_op_id,
  );
}

export async function enqueuePomodoroConfigUpdate(
  subjectKind: PomodoroSubjectKind,
  patch: Partial<PomodoroConfigRow>,
): Promise<void> {
  await enqueueOp("pomodoro.config.update", { subject_kind: subjectKind, ...patch });
}

export async function enqueuePomodoroActivePut(
  subjectKind: PomodoroSubjectKind,
  active: PomodoroActiveStatePayload,
): Promise<void> {
  await enqueueOp("pomodoro.active.put", { subject_kind: subjectKind, active });
}

export async function enqueuePomodoroActiveClear(subjectKind: PomodoroSubjectKind): Promise<void> {
  await enqueueOp("pomodoro.active.clear", { subject_kind: subjectKind });
}

export async function listPomodoroOutboxOps(): Promise<OfflineOutboxOp[]> {
  return listOutboxOps(resolveOutboxScope(), MODULE_ID);
}

export async function ackPomodoroOutboxOp(opId: string): Promise<void> {
  await removeOutboxOp(resolveOutboxScope(), opId);
}

export { MODULE_ID as POMODORO_OUTBOX_MODULE_ID };
